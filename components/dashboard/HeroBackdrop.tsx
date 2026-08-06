/**
 * Extremely subtle topographic contour + compass-rose artwork behind the
 * page intro heading. Editorial/architectural, not decorative — kept to
 * ~5% opacity and faded out before the main hero card via a mask so it
 * never competes with the content in front of it.
 */
export function HeroBackdrop() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1400 260"
      preserveAspectRatio="xMidYMin slice"
      className="pointer-events-none absolute inset-0 h-full w-full text-[#0b1a35] opacity-[0.055]"
      style={{
        maskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
      }}
    >
      {/* Topographic contour lines */}
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M-40 40 C 220 10, 460 70, 720 35 S 1180 5, 1440 45" />
        <path d="M-40 78 C 200 52, 480 108, 760 70 S 1220 44, 1440 84" />
        <path d="M-40 114 C 260 150, 520 92, 820 128 S 1240 158, 1440 118" />
        <path d="M-40 152 C 240 122, 540 178, 840 142 S 1260 110, 1440 156" />
        <path d="M-40 190 C 280 220, 560 168, 880 202 S 1280 232, 1440 192" />
      </g>

      {/* Compass rose, upper right — kept well inside the viewBox so it
          survives being cropped ("slice") to fit narrower container aspect
          ratios without losing its edge. */}
      <g transform="translate(1040 96)" fill="none" stroke="currentColor">
        <circle r="72" strokeWidth="1" />
        <circle r="53" strokeWidth="0.75" />
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i * 360) / 16;
          const long = i % 4 === 0;
          const r1 = 72;
          const r2 = long ? 61 : 66;
          const rad = (angle * Math.PI) / 180;
          return (
            <line
              key={angle}
              x1={r1 * Math.sin(rad)}
              y1={-r1 * Math.cos(rad)}
              x2={r2 * Math.sin(rad)}
              y2={-r2 * Math.cos(rad)}
              strokeWidth={long ? 1 : 0.5}
            />
          );
        })}
        <path d="M0 -32 L8 0 L0 32 L-8 0 Z" strokeWidth="1" />
        <path d="M-32 0 L0 -8 L32 0 L0 8 Z" strokeWidth="0.75" />
        <text x="0" y="-80" textAnchor="middle" fontSize="10" stroke="none" fill="currentColor">
          N
        </text>
        <text x="0" y="90" textAnchor="middle" fontSize="10" stroke="none" fill="currentColor">
          S
        </text>
        <text x="84" y="4" textAnchor="middle" fontSize="10" stroke="none" fill="currentColor">
          E
        </text>
        <text x="-84" y="4" textAnchor="middle" fontSize="10" stroke="none" fill="currentColor">
          W
        </text>
      </g>

      <text
        x="930"
        y="22"
        textAnchor="end"
        fontSize="12"
        letterSpacing="0.04em"
        stroke="none"
        fill="currentColor"
      >
        40.7128° N
      </text>
      <text
        x="930"
        y="40"
        textAnchor="end"
        fontSize="12"
        letterSpacing="0.04em"
        stroke="none"
        fill="currentColor"
      >
        74.0060° W
      </text>
    </svg>
  );
}
