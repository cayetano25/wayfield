export interface IconProps {
  /** Width and height in px. Default: 24 */
  size?: number;
  /** Primary stroke color. Default: #334155 (Slate) */
  color?: string;
  /** Accent fill/stroke color. Default: #0FA3B1 (Wayfield teal) */
  accent?: string;
  /** Extra className on the SVG element */
  className?: string;
  /** aria-label for screen readers */
  'aria-label'?: string;
}
