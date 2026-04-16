"use client";

/**
 * Brand mark — two concentric rings with gaps at ~1-2 o'clock and
 * ~7-8 o'clock, plus a solid core. The twin diagonal gaps suggest a
 * signal/pulse being emitted outward. Uses currentColor so it
 * inherits from the text color of its parent.
 */
export function BrandMark({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeLinecap="butt"
      className={className}
      aria-hidden="true"
    >
      {/* Outer ring (r=44) — two 30° gaps */}
      <path d="M 88 28 A 44 44 0 0 1 28 88" strokeWidth="11" />
      <path d="M 12 72 A 44 44 0 0 1 72 12" strokeWidth="11" />

      {/* Inner ring (r=28) — matching gap pattern */}
      <path d="M 74.25 36 A 28 28 0 0 1 36 74.25" strokeWidth="11" />
      <path d="M 25.75 64 A 28 28 0 0 1 64 25.75" strokeWidth="11" />

      {/* Solid core */}
      <circle cx="50" cy="50" r="9" fill="currentColor" stroke="none" />
    </svg>
  );
}
