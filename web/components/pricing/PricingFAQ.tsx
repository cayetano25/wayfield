'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface FaqItem {
  q: string
  a: string
}

const FAQS: FaqItem[] = [
  {
    q: "Why doesn't Wayfield charge participants?",
    a: "Wayfield is designed for workshop operators, not marketplaces. You own your audience and your pricing. We provide the tools to run your workshops—not take a cut of your business unless you choose to use payment features.",
  },
  {
    q: 'When should I upgrade from Foundation to Creator?',
    a: 'Upgrade when your workshops start repeating. Creator is designed for organizers who need more capacity, better coordination, and tools like reminders, waitlists, and analytics.',
  },
  {
    q: 'When does Studio make sense?',
    a: 'Studio is for operators running structured programs or multiple workshops. If you need custom branding, automation, multi-workshop reporting, or deeper operational control, Studio is the right fit.',
  },
  {
    q: 'What does custom branding include?',
    a: 'Custom branding on the Studio plan allows you to use your own domain (e.g. workshops.yoursite.com), apply your visual identity, and present a more professional experience to participants. This is a Studio-tier feature.',
  },
  {
    q: 'Why are messaging features limited?',
    a: 'Wayfield intentionally limits messaging to the right time and audience. Leaders can only message participants during a defined window around their assigned sessions. This prevents noise and keeps communication relevant.',
  },
  {
    q: 'Does Wayfield work without internet access?',
    a: 'Yes. Wayfield is built for real-world workshops, including remote locations. Core workshop data, your schedule, and logistics remain available even without connectivity.',
  },
  {
    q: 'What happens if I exceed my participant or workshop limits?',
    a: "Wayfield will notify you before you reach your plan limit. Existing workshops and participants are never removed. You simply won't be able to add new ones until you upgrade or free up capacity.",
  },
  {
    q: 'Can multiple people manage the same organization?',
    a: 'Yes. Creator and above support multiple organization managers. Foundation is limited to one organizer, which is designed for solo operators just getting started.',
  },
  {
    q: 'Can I try a paid plan before committing?',
    a: 'You can upgrade at any time and cancel before your next billing cycle. The Foundation plan is free indefinitely, so you can evaluate the core workflow with no risk before deciding to upgrade.',
  },
  {
    q: 'How does annual billing work?',
    a: 'Annual plans are billed once per year at 15% off the equivalent monthly rate. You can switch between monthly and annual at your next renewal.',
  },
  {
    q: 'What happens to my data if I downgrade?',
    a: 'Your data is always preserved. If you downgrade below a plan limit — for example, you have 8 active workshops on Creator and move to Foundation — you keep all existing workshops but cannot create new ones until you\'re within the limit.',
  },
  {
    q: 'What happens as my organization grows?',
    a: 'Wayfield scales with you. Creator helps you repeat workshops. Studio helps you systemize operations and build a professional brand. Enterprise helps you scale across teams and brands.',
  },
  {
    q: 'What does Enterprise include that Studio does not?',
    a: 'Enterprise adds SSO and identity control, advanced governance and auditability, full white-label platform support, and dedicated onboarding with SLA-backed support.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes. You can upgrade or move between plans as your needs evolve. Upgrades take effect immediately. Downgrades take effect at the next billing cycle.',
  },
  {
    q: 'Is Wayfield only for photography workshops?',
    a: 'No. Wayfield is designed for any workshop-based experience: creative education, professional training, retreats, multi-day intensives, and more. Photography workshops are common, but the platform works for any hands-on learning experience.',
  },
]

export function PricingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  function toggle(i: number) {
    setOpenIndex((prev) => (prev === i ? null : i))
  }

  return (
    <div>
      <h2
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '24px',
          fontWeight: 700,
          color: '#2E2E2E',
          marginBottom: '32px',
        }}
      >
        Frequently asked questions
      </h2>

      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #F3F4F6',
          overflow: 'hidden',
        }}
      >
        {FAQS.map((faq, i) => {
          const isOpen = openIndex === i
          return (
            <div
              key={i}
              style={{
                borderBottom: i < FAQS.length - 1 ? '1px solid #F3F4F6' : 'none',
              }}
            >
              <button
                type="button"
                onClick={() => toggle(i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  cursor: 'pointer',
                  border: 'none',
                  background: isOpen ? '#FAFAFA' : 'transparent',
                  textAlign: 'left',
                  gap: '12px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: isOpen ? '#0FA3B1' : '#2E2E2E',
                    flex: 1,
                  }}
                >
                  {faq.q}
                </span>
                <ChevronDown
                  size={16}
                  style={{
                    color: '#9CA3AF',
                    flexShrink: 0,
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 200ms ease',
                  }}
                />
              </button>

              {isOpen && (
                <div
                  style={{
                    padding: '0 20px 16px',
                    marginTop: '-4px',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      color: '#6B7280',
                      lineHeight: 1.7,
                      margin: 0,
                    }}
                  >
                    {faq.a}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
