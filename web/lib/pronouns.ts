export const PRONOUN_OPTIONS = [
  { value: 'he/him',     label: 'He / Him' },
  { value: 'she/her',    label: 'She / Her' },
  { value: 'they/them',  label: 'They / Them' },
  { value: 'he/they',    label: 'He / They' },
  { value: 'she/they',   label: 'She / They' },
  { value: 'ze/zir',     label: 'Ze / Zir' },
  { value: 'any',        label: 'Any pronouns' },
  { value: 'prefer_not', label: 'Prefer not to say' },
] as const

export type PronounValue = typeof PRONOUN_OPTIONS[number]['value'] | string
