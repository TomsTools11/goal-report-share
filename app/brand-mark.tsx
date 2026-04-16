"use client";

/**
 * Brand mark — concentric signal rings with aligned diagonal breaks.
 * Each ring opens toward the upper-right, creating a continuous diagonal
 * axis. Uses currentColor, so it inherits from any text color context.
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
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      {/* Outer ring — largest sweep, gap at upper-right (~45°) */}
      <path
        d="M 82.5 26 A 44 44 0 1 1 74 82.5"
        strokeWidth="10"
      />
      {/* Middle ring — mid sweep, aligned gap */}
      <path
        d="M 70 36 A 28 28 0 1 1 62 72.5"
        strokeWidth="10"
      />
      {/* Inner ring — short sweep, aligned gap */}
      <path
        d="M 60 42 A 14 14 0 1 1 54 62.5"
        strokeWidth="8"
      />
      {/* Center dot */}
      <circle cx="50" cy="50" r="6.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
