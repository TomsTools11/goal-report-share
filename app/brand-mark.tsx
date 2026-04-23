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
  const uid = "drop-clip";
  return (
    <svg
      width={size}
      height={(size * 120) / 100}
      viewBox="0 0 100 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={uid}>
          <path d="M 50 6 C 72 34 88 60 88 78 A 38 38 0 1 1 12 78 C 12 60 28 34 50 6 Z" />
        </clipPath>
      </defs>

      {/* Teardrop body */}
      <path
        d="M 50 6 C 72 34 88 60 88 78 A 38 38 0 1 1 12 78 C 12 60 28 34 50 6 Z"
        fill="var(--brand)"
      />

      <g clipPath={`url(#${uid})`}>
        {/* Lined-paper rules */}
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

        {/* Red margin rule */}
        <line
          x1="30"
          y1="0"
          x2="30"
          y2="120"
          stroke="#D85858"
          strokeWidth="0.9"
          strokeOpacity="0.85"
        />

        {/* Peeled corner — cream paper back */}
        <path
          d="M 58 14 C 56 26 62 36 72 44 C 78 48 84 50 88 50 L 88 30 C 80 24 68 18 58 14 Z"
          fill="#F2EADA"
        />
        {/* Subtle shadow along the fold */}
        <path
          d="M 58 14 C 56 26 62 36 72 44"
          stroke="#B9A986"
          strokeWidth="0.7"
          strokeOpacity="0.5"
          fill="none"
        />
      </g>
    </svg>
  );
}
