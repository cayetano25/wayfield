'use client';

import {
  ParticipantIcon,
  OrganizerIcon,
  AnyFormatIcon,
  OfflineReadyIcon,
} from '@/components/icons';

const icons = [
  { Icon: ParticipantIcon, name: 'ParticipantIcon', label: 'For Participants' },
  { Icon: OrganizerIcon,   name: 'OrganizerIcon',   label: 'For Organizers' },
  { Icon: AnyFormatIcon,   name: 'AnyFormatIcon',   label: 'Any Format' },
  { Icon: OfflineReadyIcon, name: 'OfflineReadyIcon', label: 'Offline Ready' },
] as const;

const sizes = [16, 24, 32, 48] as const;

const backgrounds = [
  { label: 'White',      bg: '#FFFFFF', text: '#2E2E2E' },
  { label: 'Light Gray', bg: '#F5F5F5', text: '#2E2E2E' },
  { label: 'Teal',       bg: '#0FA3B1', text: '#FFFFFF' },
  { label: 'Charcoal',   bg: '#2E2E2E', text: '#FFFFFF' },
] as const;

export default function IconShowcasePage() {
  return (
    <div className="p-8 space-y-12 min-h-screen bg-gray-50">
      <h1 className="font-heading text-2xl font-bold text-gray-900">
        Wayfield Feature Icons — Dev Showcase
      </h1>

      {/* Size matrix */}
      <section>
        <h2 className="font-heading text-lg font-semibold text-gray-700 mb-4">
          Sizes (on white background)
        </h2>
        <div className="flex flex-wrap gap-8 items-end">
          {icons.map(({ Icon, name }) => (
            <div key={name} className="space-y-2">
              <p className="font-mono text-xs text-gray-400">{name}</p>
              <div className="flex items-end gap-4 bg-white border border-gray-100 rounded-xl p-4">
                {sizes.map((size) => (
                  <div key={size} className="flex flex-col items-center gap-1">
                    <Icon size={size} />
                    <span className="font-mono text-xs text-gray-400">{size}px</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Background matrix */}
      <section>
        <h2 className="font-heading text-lg font-semibold text-gray-700 mb-4">
          Backgrounds (24px)
        </h2>
        <div className="flex flex-wrap gap-4">
          {backgrounds.map(({ label, bg, text }) => (
            <div key={label} className="space-y-2">
              <p className="font-mono text-xs text-gray-400">{label}</p>
              <div
                className="flex gap-4 rounded-xl p-4"
                style={{ backgroundColor: bg }}
              >
                {icons.map(({ Icon, name }) => (
                  <Icon
                    key={name}
                    size={24}
                    color={text}
                    accent="#0FA3B1"
                    aria-label={name}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Production preview note */}
      <section>
        <h2 className="font-heading text-lg font-semibold text-gray-700 mb-4">
          Production Preview
        </h2>
        <p className="font-mono text-xs text-gray-400">
          See / (landing page) for the live FeatureHighlights component.
        </p>
      </section>
    </div>
  );
}
