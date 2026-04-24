/**
 * Wayfield Feature Flags
 *
 * PAYMENTS_ENABLED: Controls all payment and pricing UI.
 *
 * When false (default at launch):
 *   - Price range filter hidden in all filter panels
 *   - "Free" / price text hidden on workshop cards
 *   - Price pill hidden in any filter bar
 *   - No checkout or cart UI rendered
 *
 * When true:
 *   - All pricing UI renders normally
 *
 * This mirrors the global payments_enabled flag in the Laravel API
 * (payment_feature_flags table, scope: platform).
 * Future: fetched from API on app load and stored in context.
 * For now: compile-time constant, default false.
 */
export const FEATURE_FLAGS = {
  PAYMENTS_ENABLED: false,
} as const;

export type FeatureFlags = typeof FEATURE_FLAGS;

/**
 * Convenience hook-style accessor.
 * Replace with a React context read when the flag becomes dynamic.
 */
export function useFeatureFlag<K extends keyof FeatureFlags>(
  flag: K
): FeatureFlags[K] {
  return FEATURE_FLAGS[flag];
}
