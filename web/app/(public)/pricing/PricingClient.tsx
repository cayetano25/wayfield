'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, ChevronDown, ArrowRight, Minus } from 'lucide-react';
import {
  PRICING_PLANS,
  COMPARISON_TABLE,
  PAYMENTS_COMPARISON_ROWS,
  PRICING_FAQS,
} from '@/lib/pricingData';
import type { PricingPlan, ComparisonRow } from '@/lib/pricingData';
import { useNavContext } from '@/lib/hooks/useNavContext';

/* ─── Types ────────────────────────────────────────────────────────────── */

type BillingPeriod = 'monthly' | 'annual';

const PLAN_KEYS = ['foundation', 'creator', 'studio', 'enterprise'] as const;

/* ─── Auth banner ─────────────────────────────────────────────────────── */

function AuthBanner() {
  const nav = useNavContext();
  const [dismissed, setDismissed] = useState(false);

  if (!nav.isAuthenticated || nav.isLoading || dismissed) return null;

  const orgName = nav.memberships[0]?.organization_name;

  return (
    <div className="bg-[#0FA3B1]/10 border-b border-[#0FA3B1]/20 py-2.5 px-6 text-center text-sm flex items-center justify-center gap-3">
      <span className="text-gray-700 font-sans">
        {orgName
          ? <>You&apos;re viewing pricing as an organizer of <strong className="text-[#0FA3B1]">{orgName}</strong>.</>
          : <>You&apos;re signed in.</>
        }{' '}
        <Link
          href="/organization/billing"
          className="text-[#0FA3B1] font-semibold underline underline-offset-2 hover:text-[#0c8a96]"
        >
          Manage your subscription →
        </Link>
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="text-gray-400 hover:text-gray-600 font-bold text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}

/* ─── Billing toggle ──────────────────────────────────────────────────── */

function BillingToggle({
  period,
  onChange,
}: {
  period: BillingPeriod;
  onChange: (p: BillingPeriod) => void;
}) {
  return (
    <div
      className="inline-flex p-1 rounded-full"
      style={{
        background: 'rgba(255,255,255,0.12)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.2)',
      }}
    >
      <button
        type="button"
        onClick={() => onChange('monthly')}
        className={`px-6 py-2 rounded-full text-sm font-semibold font-sans transition-all ${
          period === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-white/70 hover:text-white'
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange('annual')}
        className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold font-sans transition-all ${
          period === 'annual' ? 'bg-white text-gray-900 shadow-sm' : 'text-white/70 hover:text-white'
        }`}
      >
        Annual
        <span className="text-[10px] font-bold font-mono bg-[#E67E22] text-white rounded-full px-2 py-0.5">
          Save 15%
        </span>
      </button>
    </div>
  );
}

/* ─── Plan card ───────────────────────────────────────────────────────── */

function PlanCard({ plan, period }: { plan: PricingPlan; period: BillingPeriod }) {
  const isAnnual = period === 'annual';
  const isDark = plan.isDark;

  const displayPrice =
    isAnnual && plan.id !== 'foundation' && plan.annualMonthlyRate !== null
      ? `$${plan.annualMonthlyRate}`
      : plan.priceDisplay;

  const cardBorder = plan.isMostPopular
    ? '2px solid #0FA3B1'
    : isDark
    ? '1px solid rgba(255,255,255,0.1)'
    : '1px solid #E5E7EB';

  const cardShadow = plan.isMostPopular
    ? '0 4px 20px rgba(15,163,177,0.15)'
    : '0 1px 4px rgba(0,0,0,0.06)';

  const subtitleColor = isDark ? 'rgba(255,255,255,0.55)' : '#6B7280';
  const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6';
  const featureColor = isDark ? 'rgba(255,255,255,0.85)' : '#374151';

  const prevPlan =
    plan.id === 'creator' ? 'Foundation' :
    plan.id === 'studio' ? 'Creator' :
    plan.id === 'enterprise' ? 'Studio' :
    null;

  return (
    <div
      className="relative flex flex-col rounded-2xl h-full"
      style={{
        backgroundColor: isDark ? '#2E2E2E' : 'white',
        border: cardBorder,
        boxShadow: cardShadow,
        padding: '28px 24px',
      }}
    >
      {/* Badge row — always reserves space */}
      <div className="h-[22px] mb-3 flex items-center">
        {plan.isMostPopular && (
          <span
            className="inline-flex items-center px-3 py-1 rounded-full font-mono font-bold uppercase"
            style={{ fontSize: 9, letterSpacing: '0.14em', backgroundColor: '#0FA3B1', color: 'white' }}
          >
            Most Practical
          </span>
        )}
        {plan.badge && !plan.isMostPopular && (
          <span
            className="font-mono font-bold uppercase"
            style={{ fontSize: 9, letterSpacing: '0.12em', color: isDark ? 'rgba(255,255,255,0.45)' : '#0FA3B1' }}
          >
            {plan.badge}
          </span>
        )}
      </div>

      {/* Name + tagline */}
      <h3
        className="font-heading font-bold mb-1"
        style={{ fontSize: 20, color: isDark ? 'white' : '#2E2E2E' }}
      >
        {plan.name}
      </h3>
      <p className="font-sans mb-5 leading-snug" style={{ fontSize: 13, color: subtitleColor }}>
        {plan.tagline}
      </p>

      {/* Price */}
      <div className="mb-5">
        {plan.monthlyPrice !== null ? (
          <>
            <div className="flex items-baseline gap-1">
              <span
                className="font-heading font-bold leading-none"
                style={{ fontSize: 38, color: isDark ? 'white' : '#2E2E2E' }}
              >
                {displayPrice}
              </span>
              {plan.monthlyPrice > 0 && (
                <span className="font-sans" style={{ fontSize: 13, color: subtitleColor }}>
                  /mo
                </span>
              )}
            </div>
            {isAnnual && plan.id !== 'foundation' && plan.annualTotal !== null && plan.annualTotal > 0 && (
              <p className="font-sans mt-1" style={{ fontSize: 12, color: subtitleColor }}>
                Billed as {plan.annualTotalDisplay}/year
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
            <span className="font-heading font-bold leading-none" style={{ fontSize: 38, color: 'white' }}>
              Custom
            </span>
            <p className="font-sans mt-1" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              Contact us for pricing
            </p>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="mb-5" style={{ height: 1, backgroundColor: dividerColor }} />

      {/* Best for */}
      <div className="mb-5">
        <p
          className="font-mono font-bold uppercase mb-1"
          style={{ fontSize: 10, letterSpacing: '0.1em', color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF' }}
        >
          Best For
        </p>
        <p className="font-sans italic" style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.7)' : '#6B7280' }}>
          {plan.bestFor}
        </p>
      </div>

      {/* Features */}
      <div className="mb-7 flex-1">
        <p
          className="font-mono font-bold uppercase mb-2"
          style={{ fontSize: 10, letterSpacing: '0.1em', color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF' }}
        >
          What&apos;s included
        </p>
        {prevPlan && (
          <p className="font-sans italic mb-3" style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF' }}>
            Everything in {prevPlan}, plus:
          </p>
        )}
        <ul className="space-y-2.5">
          {plan.features.map((feat) => (
            <li key={feat} className="flex items-start gap-2">
              <Check
                size={14}
                className="flex-shrink-0 mt-0.5"
                style={{ color: isDark ? 'rgba(255,255,255,0.6)' : '#0FA3B1' }}
              />
              <span className="font-sans leading-snug" style={{ fontSize: 13, color: featureColor }}>
                {feat}
              </span>
            </li>
          ))}
          {plan.takeRate && (
            <li className="flex items-start gap-2">
              <Check
                size={14}
                className="flex-shrink-0 mt-0.5"
                style={{ color: isDark ? 'rgba(255,255,255,0.6)' : '#0FA3B1' }}
              />
              <span className="font-sans font-medium leading-snug" style={{ fontSize: 13, color: featureColor }}>
                {plan.takeRate}
              </span>
            </li>
          )}
        </ul>
      </div>

      {/* CTA */}
      <div className="mt-auto">
        <Link
          href={plan.ctaHref}
          className="flex items-center justify-center w-full rounded-xl font-sans font-semibold transition-colors"
          style={
            plan.ctaStyle === 'solid-teal'
              ? { height: 44, fontSize: 14, backgroundColor: '#0FA3B1', color: 'white' }
              : plan.ctaStyle === 'outline-orange'
              ? { height: 44, fontSize: 14, border: '1.5px solid #E67E22', color: '#E67E22', backgroundColor: 'white' }
              : plan.ctaStyle === 'outline-teal'
              ? { height: 44, fontSize: 14, border: '1.5px solid #0FA3B1', color: '#0FA3B1', backgroundColor: 'white' }
              : { height: 44, fontSize: 14, border: '1.5px solid rgba(255,255,255,0.3)', color: 'white', backgroundColor: 'rgba(255,255,255,0.08)' }
          }
        >
          {plan.ctaLabel}
        </Link>
      </div>
    </div>
  );
}

/* ─── Comparison cell ─────────────────────────────────────────────────── */

function CompCell({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check size={16} className="inline" style={{ color: '#0FA3B1' }} />;
  }
  if (value === false) {
    return <Minus size={14} className="inline" style={{ color: '#D1D5DB' }} />;
  }
  return <span className="font-sans font-medium" style={{ fontSize: 13, color: '#2E2E2E' }}>{value}</span>;
}

/* ─── Comparison table ────────────────────────────────────────────────── */

const ALL_SECTIONS = [...COMPARISON_TABLE, ...PAYMENTS_COMPARISON_ROWS];

function ComparisonTable() {
  return (
    <>
      {/* Mobile scroll hint */}
      <p className="text-xs text-gray-400 text-center mb-3 sm:hidden font-sans">
        ← Scroll to compare →
      </p>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th
                className="p-4 text-left border-b border-gray-100 font-mono font-bold uppercase"
                style={{ fontSize: 10, letterSpacing: '0.12em', color: '#9CA3AF' }}
              >
                Feature
              </th>
              {(['Foundation', 'Creator', 'Studio', 'Enterprise'] as const).map((name) => (
                <th
                  key={name}
                  className="p-4 text-center border-b border-gray-100"
                  style={{
                    minWidth: 100,
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: 'Sora, sans-serif',
                    color: name === 'Creator' ? '#0FA3B1' : '#2E2E2E',
                    backgroundColor: name === 'Studio' ? 'rgba(15,163,177,0.04)' : undefined,
                  }}
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_SECTIONS.map((section) => (
              <React.Fragment key={section.category}>
                {/* Category row */}
                <tr>
                  <td
                    colSpan={5}
                    className="font-mono font-bold uppercase"
                    style={{
                      padding: '10px 16px 6px',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      color: '#9CA3AF',
                      backgroundColor: '#F9FAFB',
                    }}
                  >
                    {section.category}
                  </td>
                </tr>

                {/* Feature rows */}
                {section.rows.map((row: ComparisonRow, i) => (
                  <tr
                    key={row.feature}
                    style={{ backgroundColor: i % 2 === 0 ? 'white' : 'rgba(249,250,251,0.5)' }}
                  >
                    <td className="font-sans py-3 px-4" style={{ fontSize: 13, color: '#4B5563' }}>
                      {row.feature}
                    </td>
                    {PLAN_KEYS.map((key) => (
                      <td
                        key={key}
                        className="py-3 px-4 text-center"
                        style={{
                          minWidth: 100,
                          backgroundColor: key === 'studio' ? 'rgba(15,163,177,0.04)' : undefined,
                        }}
                      >
                        <CompCell value={row[key]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ─── FAQ item ────────────────────────────────────────────────────────── */

function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-4 px-5 text-left hover:bg-gray-50 transition-colors rounded-lg"
      >
        <span
          className="font-sans font-medium flex-1 pr-4"
          style={{ fontSize: 14, color: isOpen ? '#0FA3B1' : '#2E2E2E' }}
        >
          {question}
        </span>
        <ChevronDown
          size={16}
          className="flex-shrink-0 transition-transform duration-200"
          style={{ color: '#9CA3AF', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 -mt-1">
          <p className="font-sans leading-relaxed" style={{ fontSize: 14, color: '#6B7280' }}>
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────── */

export function PricingClient() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <>
      <AuthBanner />

      {/* ── Section 1: Hero ─────────────────────────────────────── */}
      <section
        className="relative w-full overflow-hidden flex flex-col items-center justify-center text-center"
        style={{ minHeight: '55vh', paddingTop: 80, paddingBottom: 64, paddingLeft: 24, paddingRight: 24 }}
      >
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="/images/hero/mountain-golden-hour.webp"
            alt="Dramatic mountain landscape at golden hour"
            fill
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/82" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center">
          <p
            className="font-mono font-bold uppercase mb-5"
            style={{ fontSize: 11, letterSpacing: '0.15em', color: '#0FA3B1' }}
          >
            Pricing
          </p>
          <h1
            className="font-heading font-bold text-white mb-4 leading-tight"
            style={{ fontSize: 'clamp(30px, 5.5vw, 52px)', maxWidth: 680 }}
          >
            Simple pricing that grows with you.
          </h1>
          <p
            className="font-sans mb-10 leading-relaxed"
            style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', maxWidth: 480 }}
          >
            No hidden fees. No per-participant charges. Just tools that grow with your workshop program.
          </p>
          <BillingToggle period={period} onChange={setPeriod} />
        </div>
      </section>

      {/* ── Section 2: Plan cards ────────────────────────────────── */}
      <section
        className="relative z-10 px-5 pb-16"
        style={{ backgroundColor: '#F9FAFB', marginTop: -32 }}
      >
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-8">
            {PRICING_PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} period={period} />
            ))}
          </div>
          {period === 'annual' && (
            <p className="text-center font-sans mt-6" style={{ fontSize: 13, color: '#9CA3AF' }}>
              Annual plans are billed upfront and save 15% compared to monthly billing.
            </p>
          )}
        </div>
      </section>

      {/* ── Section 3: Comparison table ──────────────────────────── */}
      <section className="px-5 py-16 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2
              className="font-heading font-bold mb-3"
              style={{ fontSize: 'clamp(22px, 3.5vw, 32px)', color: '#2E2E2E' }}
            >
              Compare every feature
            </h2>
            <p className="font-sans" style={{ fontSize: 15, color: '#6B7280' }}>
              Everything across all plans, side by side.
            </p>
          </div>
          <ComparisonTable />
        </div>
      </section>

      {/* ── Section 4: Testimonial ───────────────────────────────── */}
      <section
        className="relative w-full overflow-hidden flex items-center justify-center px-5 py-16"
        style={{ minHeight: 400 }}
      >
        {/* Background */}
        <div className="absolute inset-0">
          <Image
            src="/images/hero/photographer-field.webp"
            alt="Photographer leading a workshop in the field"
            fill
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/65" />
        </div>

        {/* Glass card */}
        <div
          className="relative z-10 max-w-xl w-full"
          style={{
            background: 'rgba(255,255,255,0.10)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 20,
            padding: '40px 44px',
          }}
        >
          <div
            className="font-heading font-bold leading-none mb-4"
            style={{ fontSize: 96, color: '#0FA3B1', lineHeight: 0.75 }}
            aria-hidden="true"
          >
            &ldquo;
          </div>
          <blockquote
            className="font-sans italic text-white mb-6 leading-relaxed"
            style={{ fontSize: 20 }}
          >
            Wayfield completely transformed how we run our workshops. The session
            selection and attendance tools saved us hours and let us focus on the
            actual teaching.
          </blockquote>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-full font-sans font-bold text-white flex-shrink-0"
              style={{ width: 40, height: 40, backgroundColor: '#0FA3B1', fontSize: 14 }}
            >
              SM
            </div>
            <div>
              <p className="font-sans font-semibold text-white" style={{ fontSize: 14 }}>
                Sarah M.
              </p>
              <p className="font-sans" style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                Workshop Organizer
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: FAQ ───────────────────────────────────────── */}
      <section className="px-5 py-16 bg-white">
        <div className="max-w-[720px] mx-auto">
          <div className="text-center mb-10">
            <h2
              className="font-heading font-bold"
              style={{ fontSize: 24, color: '#2E2E2E' }}
            >
              Frequently asked questions
            </h2>
          </div>
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            {PRICING_FAQS.map((faq, i) => (
              <FaqItem
                key={i}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 6: Final CTA ─────────────────────────────────── */}
      <section
        className="px-5 py-24 text-center"
        style={{ backgroundColor: '#1E1E2E' }}
      >
        <div className="max-w-xl mx-auto">
          <h2
            className="font-heading font-bold text-white mb-4 leading-tight"
            style={{ fontSize: 'clamp(26px, 4.5vw, 40px)' }}
          >
            Ready to start your next workshop?
          </h2>
          <p
            className="font-sans mb-10 leading-relaxed"
            style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)' }}
          >
            Join organizers, leaders, and participants building better workshop experiences.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Link
              href="/register"
              className="inline-flex items-center justify-center font-sans font-bold rounded-xl transition-all hover:bg-[#0c8a96]"
              style={{
                height: 52,
                paddingLeft: 32,
                paddingRight: 32,
                fontSize: 15,
                backgroundColor: '#0FA3B1',
                color: 'white',
              }}
            >
              Start Free
            </Link>
            <Link
              href="/workshops"
              className="inline-flex items-center gap-2 font-sans font-semibold rounded-xl transition-all hover:bg-white/10"
              style={{
                height: 52,
                paddingLeft: 32,
                paddingRight: 32,
                fontSize: 15,
                border: '1.5px solid rgba(255,255,255,0.3)',
                color: 'white',
              }}
            >
              Explore Workshops <ArrowRight size={16} />
            </Link>
          </div>
          <p
            className="font-mono font-bold uppercase"
            style={{ fontSize: 11, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)' }}
          >
            Free plan. No credit card required.
          </p>
        </div>
      </section>
    </>
  );
}
