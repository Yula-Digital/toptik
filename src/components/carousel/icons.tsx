// Inline SVG icons (no external asset needed) — brown, scale-crisp, currentColor.
// Zoom360: magnifier enclosing a 360° rotation mark (catalog card CTA).
// Rotate360: a 360° rotation mark (product modal "more angles" hint).

type IconProps = { className?: string };

export function Zoom360Icon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* magnifier lens */}
      <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="8" />
      {/* handle */}
      <path d="M63 63 L91 91" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
      {/* 360 */}
      <text
        x="39"
        y="37"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-rubik), Rubik, system-ui, sans-serif"
        fontSize="21"
        fontWeight="800"
        fill="currentColor"
      >
        360
      </text>
      {/* degree */}
      <circle cx="60" cy="22" r="4" stroke="currentColor" strokeWidth="2.6" />
      {/* rotation orbit + arrowhead */}
      <path d="M19 53 A 21 8 0 1 0 59 53" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M51 47 L63 53 L51 60" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Rotate360Icon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 86"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 360 */}
      <text
        x="55"
        y="33"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-rubik), Rubik, system-ui, sans-serif"
        fontSize="40"
        fontWeight="800"
        fill="currentColor"
      >
        360
      </text>
      {/* degree */}
      <circle cx="101" cy="13" r="7" stroke="currentColor" strokeWidth="4.5" />
      {/* rotation orbit + arrowhead */}
      <path d="M16 58 A 44 16 0 1 0 104 58" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
      <path d="M89 45 L110 58 L89 71" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
