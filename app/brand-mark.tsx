"use client";

/**
 * DropDoc brand mark — a teardrop-shaped sheet of lined paper with a
 * peeled corner. The teardrop evokes "drop" (as in drag-and-drop) and the
 * lined-paper texture plus page curl evoke "doc".
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
      height={(size * 120) / 100}
      viewBox="0 0 100 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <MarkGlyph idPrefix="drop-clip" />
    </svg>
  );
}

/**
 * Full DropDoc lockup — teardrop mark + wordmark, rendered as a single
 * cohesive SVG so it scales as one unit. The wordmark uses currentColor so
 * it picks up the surrounding text color (primary by default, dark-mode safe).
 */
export function BrandLockup({
  height = 26,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <svg
      height={height}
      width={(height * 420) / 120}
      viewBox="0 0 420 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="DropDoc"
    >
      <MarkGlyph idPrefix="drop-clip-lockup" />
      <text
        x="122"
        y="86"
        fill="currentColor"
        fontSize="74"
        fontWeight={650}
        letterSpacing="-3.2"
        style={{
          fontFamily:
            "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        DropDoc
      </text>
    </svg>
  );
}

function MarkGlyph({ idPrefix }: { idPrefix: string }) {
  const clipId = `${idPrefix}-clip`;
  const teardrop = "M 50 6 C 72 34 88 60 88 78 A 38 38 0 1 1 12 78 C 12 60 28 34 50 6 Z";
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <path d={teardrop} />
        </clipPath>
      </defs>

      <path d={teardrop} fill="var(--brand)" />

      <g clipPath={`url(#${clipId})`}>
        <g stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.55">
          <line x1="0" y1="34" x2="100" y2="34" />
          <line x1="0" y1="44" x2="100" y2="44" />
          <line x1="0" y1="54" x2="100" y2="54" />
          <line x1="0" y1="64" x2="100" y2="64" />
          <line x1="0" y1="74" x2="100" y2="74" />
          <line x1="0" y1="84" x2="100" y2="84" />
          <line x1="0" y1="94" x2="100" y2="94" />
          <line x1="0" y1="104" x2="100" y2="104" />
        </g>

        <line
          x1="30"
          y1="0"
          x2="30"
          y2="120"
          stroke="#D85858"
          strokeWidth="0.9"
          strokeOpacity="0.85"
        />

        <path
          d="M 58 14 C 56 26 62 36 72 44 C 78 48 84 50 88 50 L 88 30 C 80 24 68 18 58 14 Z"
          fill="#F2EADA"
        />
        <path
          d="M 58 14 C 56 26 62 36 72 44"
          stroke="#B9A986"
          strokeWidth="0.7"
          strokeOpacity="0.5"
          fill="none"
        />
      </g>
    </>
  );
}
