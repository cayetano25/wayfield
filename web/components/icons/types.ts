export interface IconProps {
  /** Icon size in px. Applied to width and height. Default: 24 */
  size?: number;
  /** Stroke color. Default: Wayfield charcoal #2E2E2E */
  color?: string;
  /** Accent fill color for inner highlights. Default: Wayfield teal #0FA3B1 */
  accent?: string;
  /** Additional className for the SVG element */
  className?: string;
  /** aria-label for accessibility. Provide when icon has no visible text label */
  'aria-label'?: string;
}
