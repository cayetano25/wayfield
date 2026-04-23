// City-level overrides: these regions deviate from their continent's default hour cycle.
// London is included here because en-GB uses h12 despite Europe's de-DE default being h23.
const CITY_LOCALE_MAP: Record<string, string> = {
  Kolkata: 'en-IN',
  Colombo: 'en-LK',
  Karachi: 'en-PK',
  Dhaka: 'en-BD',
  Manila: 'en-PH',
  Yangon: 'my-MM',
  Lagos: 'en-NG',
  Nairobi: 'sw-KE',
  Accra: 'en-GH',
  Cairo: 'ar-EG',
  Auckland: 'en-NZ',
  Guam: 'en-GU',
  Port_Moresby: 'en-PG',
  // en-GB changed to h23 in modern CLDR; en-001 (World English) stably uses h12
  London: 'en-001',
};

const REGION_LOCALE_MAP: Record<string, string> = {
  America: 'en-US',
  US: 'en-US',
  Canada: 'en-CA',
  Pacific: 'en-US',
  Atlantic: 'en-US',
  Australia: 'en-AU',
  Europe: 'de-DE',
  Asia: 'ja-JP',
  Africa: 'fr-FR',
  Indian: 'fr-FR',
  Antarctica: 'en-US',
};

export function detectHourCycle(ianaTimezone: string): '12' | '24' {
  try {
    const segments = ianaTimezone.split('/');
    const city = segments[segments.length - 1];
    const region = segments[0];

    const locale: string =
      CITY_LOCALE_MAP[city] ??
      REGION_LOCALE_MAP[region] ??
      'en-US';

    const formatter = new Intl.DateTimeFormat(locale, { hour: 'numeric' });
    const hourCycle = formatter.resolvedOptions().hourCycle;
    return hourCycle === 'h11' || hourCycle === 'h12' ? '12' : '24';
  } catch {
    return '12';
  }
}

export function localToUTC(
  date: string,
  time: string,
  ianaTimezone: string
): string {
  try {
    const dateParts = date.split('-');
    const timeParts = time.split(':');

    if (dateParts.length !== 3 || timeParts.length !== 2) {
      throw new Error(
        `Invalid format: expected date 'YYYY-MM-DD' and time 'HH:mm', got date='${date}' time='${time}'`
      );
    }

    const year = Number(dateParts[0]);
    const month = Number(dateParts[1]);
    const day = Number(dateParts[2]);
    const hour = Number(timeParts[0]);
    const minute = Number(timeParts[1]);

    if ([year, month, day, hour, minute].some(isNaN)) {
      throw new Error(
        `Non-numeric values in date='${date}' or time='${time}'`
      );
    }

    const target = Date.UTC(year, month - 1, day, hour, minute, 0);
    let guess = target;

    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: ianaTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Two-pass iteration: adjust guess until the formatted local time matches the
    // desired local time. Two passes converge correctly for all DST transitions.
    for (let i = 0; i < 2; i++) {
      const parts = fmt.formatToParts(new Date(guess));
      const p = Object.fromEntries(
        parts.map(({ type, value }) => [type, value])
      );
      const localInZone = Date.UTC(
        Number(p.year),
        Number(p.month) - 1,
        Number(p.day),
        Number(p.hour) % 24, // guard against h24 returning '24' for midnight
        Number(p.minute),
        Number(p.second)
      );
      guess += target - localInZone;
    }

    return new Date(guess).toISOString();
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error(
      `localToUTC failed for date='${date}', time='${time}', timezone='${ianaTimezone}'`
    );
  }
}

export function UTCToLocal(
  utcISOString: string,
  ianaTimezone: string
): { date: string; time: string } {
  const date = new Date(utcISOString);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ianaTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const p = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );
  // Guard against h24 returning '24' for midnight
  const normalizedHour = p.hour === '24' ? '00' : p.hour;

  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${normalizedHour}:${p.minute}`,
  };
}

export function generateTimeSlots(
  intervalMinutes: 15 | 30 = 15,
  hourCycle: '12' | '24' = '12'
): Array<{ value: string; label: string }> {
  const slots: Array<{ value: string; label: string }> = [];

  for (let totalMinutes = 0; totalMinutes < 1440; totalMinutes += intervalMinutes) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    const value = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    let label: string;
    if (hourCycle === '24') {
      label = value;
    } else {
      const period = totalMinutes < 720 ? 'AM' : 'PM';
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      label = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
    }

    slots.push({ value, label });
  }

  return slots;
}
