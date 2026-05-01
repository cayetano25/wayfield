'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, Minus, ChevronDown, Zap } from 'lucide-react';
import {
  PRICING_PLANS,
  COMPARISON_TABLE,
  PAYMENTS_COMPARISON_ROWS,
  PRICING_FAQS,
} from '@/lib/pricingData';
import type { PricingPlan } from '@/lib/pricingData';

/* --- Billing toggle ---------------------------------------------------- */

type BillingPeriod = 'monthly' | 'annual';

function BillingToggle({
  period,
  onChange,
}: {
  period: BillingPeriod;
  onChange: (p: BillingPeriod) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full p-1 font-sans" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
      <button
        type="button"
        onClick={() => onChange('monthly')}
        className="rounded-full font-semibold transition-all"
        style={{
          fontSize: 14,
          padding: '7px 20px',
          backgroundColor: period === 'monthly' ? 'white' : 'transparent',
          color: period === 'monthly' ? '#2E2E2E' : 'rgba(255,255,255,0.7)',
        }}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange('annual')}
        className="inline-flex items-center gap-2 rounded-full font-semibold transition-all"
        style={{
          fontSize: 14,
          padding: '7px 20px',
          backgroundColor: period === 'annual' ? 'white' : 'transparent',
          color: period === 'annual' ? '#2E2E2E' : 'rgba(255,255,255,0.7)',
        }}
      >
        Annual
        <span
          className="rounded-full font-bold font-mono"
          style={{
            fontSize: 10,
            padding: '2px 7px',
            backgroundColor: '#0FA3B1',
            color: 'white',
            letterSpacing: '0.05em',
          }}
        >
          SAVE 15%
        </span>
      </button>
    </div>
  );
}

/* --- Plan card CTA button ---------------------------------------------- */

function PlanCta({ plan }: { plan: PricingPlan }) {
  const base = 'inline-flex items-center justify-center font-sans font-bold rounded-lg transition-all';
  const size = 'w-full h-11 text-sm';

  if (plan.ctaStyle === 'solid-teal') {
    return (
      <Link
        href={plan.ctaHref}
        className={`${base} ${size}`}
        style={{ backgroundColor: '#0FA3B1', color: 'white' }}
      >
        {plan.ctaLabel}
      </Link>
    );
  }
  if (plan.ctaStyle === 'outline-orange') {
    return (
      <Link
        href={plan.ctaHref}
        className={`${base} ${size} hover:bg-orange-50`}
        style={{ border: '1.5px solid #E67E22', color: '#E67E22' }}
      >
        {plan.ctaLabel}
      </Link>
    );
  }
  if (plan.ctaStyle === 'outline-teal') {
    return (
      <Link
        href={plan.ctaHref}
        className={`${base} ${size} hover:bg-teal-50`}
        style={{ border: '1.5px solid #0FA3B1', color: '#0FA3B1' }}
      >
        {plan.ctaLabel}
      </Link>
    );
  }
  // outline-white (Enterprise dark card)
  return (
    <Link
      href={plan.ctaHref}
      className={`${base} ${size}`}
      style={{
        border: '1.5px solid rgba(255,255,255,0.4)',
        color: 'white',
        backgroundColor: 'rgba(255,255,255,0.08)',
      }}
    >
      {plan.ctaLabel}
    </Link>
  );
}

/* --- Plan card --------------------------------------------------------- */

function PlanCard({
  plan,
  period,
}: {
  plan: PricingPlan;
  period: BillingPeriod;
}) {
  const price = period === 'annual' ? plan.annualPriceDisplay : plan.priceDisplay;
  const isPopular = plan.isMostPopular;
  const isDark = plan.isDark;

  const cardStyle: React.CSSProperties = isDark
    ? { backgroundColor: '#2E2E2E', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }
    : isPopular
    ? {
        backgroundColor: 'white',
        border: '2px solid #0FA3B1',
        boxShadow: '0 0 0 4px rgba(15,163,177,0.1), 0 8px 32px rgba(15,163,177,0.15)',
      }
    : { backgroundColor: 'white', border: '1px solid #E5E7EB' };

  const subtitleColor = isDark ? 'rgba(255,255,255,0.55)' : '#6B7280';
  const featureColor = isDark ? 'rgba(255,255,255,0.8)' : '#4B5563';
  const checkColor = isDark ? '#0FA3B1' : '#0FA3B1';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6';

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden" style={{ ...cardStyle, padding: '28px 24px' }}>
      {/* Badge */}
      <div className="h-6 mb-3">
        {plan.badge && (
          <span
            className="inline-block font-mono font-bold uppercase rounded-full"
            style={{
              fontSize: 10,
              padding: '3px 10px',
              letterSpacing: '0.1em',
              backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#F0FDFF',
              color: isDark ? 'rgba(255,255,255,0.7)' : '#0FA3B1',
              border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(15,163,177,0.3)',
            }}
          >
            {plan.badge}
          </span>
        )}
      </div>

      {/* Plan name + tagline */}
      <h3
        className="font-heading font-bold mb-1"
        style={{ fontSize: 20, color: isDark ? 'white' : '#2E2E2E' }}
      >
        {plan.name}
      </h3>
      <p className="font-sans leading-snug mb-6" style={{ fontSize: 13, color: subtitleColor }}>
        {plan.tagline}
      </p>

      {/* Price */}
      <div className="mb-6">
        {plan.monthlyPrice !== null ? (
          <>
            <div className="flex items-end gap-1">
              <span
                className="font-heading font-bold leading-none"
                style={{ fontSize: 40, color: isDark ? 'white' : '#2E2E2E' }}
              >
                {price}
              </span>
              {plan.monthlyPrice > 0 && (
                <span className="font-sans mb-1.5" style={{ fontSize: 13, color: subtitleColor }}>
                  /mo
                </span>
              )}
            </div>
            {period === 'annual' && plan.annualTotal !== null && plan.annualTotal > 0 && (
              <p className="font-sans mt-1" style={{ fontSize: 12, color: subtitleColor }}>
                {plan.annualTotalDisplay} billed annually
              </p>
            )}
            {plan.monthlyPrice === 0 && (
              <p className="font-sans mt-1" style={{ fontSize: 12, color: subtitleColor }}>
                Free forever
              </p>
            )}
          </>
        ) : (
          <>
            <span
              className="font-heading font-bold leading-none"
              style={{ fontSize: 40, color: 'white' }}
            >
              Custom
            </span>
            <p className="font-sans mt-1" style={{ fontSize: 12, color: subtitleColor }}>
              Contact us for pricing
            </p>
          </>
        )}
      </div>

      {/* CTA */}
      <PlanCta plan={plan} />

      {/* Divider */}
      <div className="my-6" style={{ height: 1, backgroundColor: dividerColor }} />

      {/* Features */}
      <p className="font-sans font-semibold mb-3" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: subtitleColor }}>
        {plan.id === 'foundation' ? "What's included" : "Everything in " + (plan.id === 'creator' ? 'Foundation' : plan.id === 'studio' ? 'Creator' : 'Studio') + ", plus"}
      </p>
      <ul className="flex flex-col gap-2.5 flex-1">
        {plan.features.map((feat) => (
          <li key={feat} className="flex items-start gap-2.5">
            <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: checkColor }} />
            <span className="font-sans leading-snug" style={{ fontSize: 13, color: featureColor }}>
              {feat}
            </span>
          </li>
        ))}
        {plan.takeRate && (
          <li className="flex items-start gap-2.5 mt-1">
            <Zap size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#E67E22' }} />
            <span className="font-sans leading-snug" style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.65)' : '#6B7280' }}>
              {plan.takeRate}
            </span>
          </li>
        )}
      </ul>

      {/* Best for */}
      <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${dividerColor}` }}>
        <p className="font-sans" style={{ fontSize: 12, color: subtitleColor }}>
          <span className="font-semibold">Best for:</span> {plan.bestFor}
        </p>
      </div>
    </div>
  );
}

/* --- Comparison table cell --------------------------------------------- */

function Cell({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <div className="flex justify-center">
        <Check size={16} style={{ color: '#0FA3B1' }} />
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="flex justify-center">
        <Minus size={14} style={{ color: '#D1D5DB' }} />
      </div>
    );
  }
  return (
    <div className="text-center font-sans font-medium" style={{ fontSize: 13, color: '#2E2E2E' }}>
      {value}
    </div>
  );
}

/* --- Comparison table -------------------------------------------------- */

const ALL_SECTIONS = [...COMPARISON_TABLE, ...PAYMENTS_COMPARISON_ROWS];

function ComparisonTable() {
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(ALL_SECTIONS.map((s) => s.category)),
  );

  function toggle(category: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  const cols = ['Foundation', 'Creator', 'Studio', 'Enterprise'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth: 640 }}>
        <thead>
          <tr>
            <th className="text-left pb-4" style={{ width: '35%' }} />
            {cols.map((col) => (
              <th
                key={col}
                className="text-center pb-4 font-heading font-bold"
                style={{ fontSize: 14, color: col === 'Creator' ? '#0FA3B1' : '#2E2E2E' }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_SECTIONS.map((section) => {
            const isOpen = openSections.has(section.category);
            return (
              <React.Fragment key={section.category}>
                {/* Section header */}
                <tr>
                  <td
                    colSpan={5}
                    className="cursor-pointer select-none"
                    style={{ paddingTop: 24, paddingBottom: 8 }}
                    onClick={() => toggle(section.category)}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono font-bold uppercase"
                        style={{ fontSize: 11, letterSpacing: '0.1em', color: '#9CA3AF' }}
                      >
                        {section.category}
                      </span>
                      <ChevronDown
                        size={13}
                        className="transition-transform duration-200"
                        style={{ color: '#9CA3AF', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      />
                    </div>
                  </td>
                </tr>

                {/* Feature rows */}
                {isOpen &&
                  section.rows.map((row, idx) => (
                    <tr
                      key={`${section.category}-${idx}`}
                      style={{
                        borderTop: '1px solid #F3F4F6',
                        backgroundColor: idx % 2 === 0 ? 'white' : '#FAFAFA',
                      }}
                    >
                      <td
                        className="font-sans py-3 pr-4"
                        style={{ fontSize: 13, color: '#4B5563' }}
                      >
                        {row.feature}
                      </td>
                      <td className="py-3 px-2"><Cell value={row.foundation} /></td>
                      <td className="py-3 px-2" style={{ backgroundColor: 'rgba(15,163,177,0.04)' }}>
                        <Cell value={row.creator} />
                      </td>
                      <td className="py-3 px-2"><Cell value={row.studio} /></td>
                      <td className="py-3 px-2"><Cell value={row.enterprise} /></td>
                    </tr>
                  ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* --- FAQ accordion ----------------------------------------------------- */

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="border-b cursor-pointer"
      style={{ borderColor: '#E5E7EB' }}
      onClick={() => setOpen((o) => !o)}
    >
      <div className="flex items-center justify-between py-5 gap-4">
        <h3 className="font-sans font-semibold text-left" style={{ fontSize: 15, color: '#2E2E2E' }}>
          {question}
        </h3>
        <ChevronDown
          size={18}
          className="flex-shrink-0 transition-transform duration-200"
          style={{ color: '#9CA3AF', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </div>
      {open && (
        <p
          className="font-sans pb-5 leading-relaxed"
          style={{ fontSize: 14, color: '#6B7280' }}
        >
          {answer}
        </p>
      )}
    </div>
  );
}

/* --- Main client component --------------------------------------------- */

export function PricingClient() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section
        className="text-white text-center px-6 py-20"
        style={{ backgroundColor: '#2E2E2E' }}
      >
        <div className="max-w-2xl mx-auto">
          <p
            className="font-mono font-bold uppercase mb-4 tracking-widest"
            style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}
          >
            Pricing
          </p>
          <h1
            className="font-heading font-bold mb-4 leading-tight"
            style={{ fontSize: 'clamp(28px, 5vw, 46px)' }}
          >
            Simple pricing for serious<br className="hidden sm:block" /> workshop operators
          </h1>
          <p
            className="font-sans mb-10 leading-relaxed"
            style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', maxWidth: 480, margin: '0 auto 40px' }}
          >
            Start free. Scale when you&apos;re ready. No per-participant fees — ever.
          </p>
          <BillingToggle period={period} onChange={setPeriod} />
        </div>
      </section>

      {/* ── Plan cards ────────────────────────────────────────────── */}
      <section className="px-6 py-16" style={{ backgroundColor: '#F9FAFB' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PRICING_PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} period={period} />
            ))}
          </div>

          {/* Annual savings note */}
          {period === 'annual' && (
            <p
              className="text-center font-sans mt-8"
              style={{ fontSize: 13, color: '#9CA3AF' }}
            >
              Annual plans are billed upfront and save you 15% vs monthly billing.
            </p>
          )}
        </div>
      </section>

      {/* ── Comparison table ──────────────────────────────────────── */}
      <section className="px-6 py-16 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="font-heading font-bold mb-3"
              style={{ fontSize: 'clamp(22px, 3.5vw, 32px)', color: '#2E2E2E' }}
            >
              Compare every plan
            </h2>
            <p className="font-sans" style={{ fontSize: 15, color: '#6B7280' }}>
              Click any section header to expand or collapse it.
            </p>
          </div>
          <ComparisonTable />
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section className="px-6 py-16" style={{ backgroundColor: '#F9FAFB' }}>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="font-heading font-bold mb-3"
              style={{ fontSize: 'clamp(22px, 3.5vw, 32px)', color: '#2E2E2E' }}
            >
              Common questions
            </h2>
          </div>
          <div>
            {PRICING_FAQS.map((faq, i) => (
              <FaqItem key={i} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────── */}
      <section
        className="px-6 py-20 text-center text-white"
        style={{ backgroundColor: '#0FA3B1' }}
      >
        <div className="max-w-xl mx-auto">
          <h2
            className="font-heading font-bold mb-4 leading-tight"
            style={{ fontSize: 'clamp(22px, 4vw, 34px)' }}
          >
            Ready to run your first workshop?
          </h2>
          <p
            className="font-sans mb-10 leading-relaxed"
            style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)' }}
          >
            Foundation is free forever. No credit card needed.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center justify-center font-sans font-bold rounded-lg transition-all hover:bg-gray-100"
              style={{
                fontSize: 15,
                padding: '13px 32px',
                backgroundColor: 'white',
                color: '#0FA3B1',
              }}
            >
              Start free — no card required
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center font-sans font-semibold rounded-lg transition-all hover:bg-white/10"
              style={{
                fontSize: 15,
                padding: '13px 32px',
                border: '1.5px solid rgba(255,255,255,0.5)',
                color: 'white',
              }}
            >
              Talk to us →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
