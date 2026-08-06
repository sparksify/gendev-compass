/**
 * Extremely subtle topographic contour + compass-rose artwork behind the
 * page intro heading. Editorial/architectural, not decorative — kept to
 * low opacity and faded out before the main hero card via a mask so it
 * never competes with the content in front of it.
 *
 * The compass is its own fixed-size SVG (not stretched to the container
 * viewBox) so it always renders as a crisp, undistorted circle regardless
 * of the intro area's aspect ratio at any breakpoint.
 */
export function HeroBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden text-[#0b1a35]"
      style={{
        maskImage: "linear-gradient(to bottom, black 0%, black 45%, transparent 92%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 45%, transparent 92%)",
      }}
    >
      {/* Topographic contour lines, full width */}
      <svg
        viewBox="0 0 1400 220"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full opacity-[0.08]"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M-40 32 C 220 4, 460 58, 720 28 S 1180 2, 1440 36" />
          <path d="M-40 64 C 200 42, 480 92, 760 58 S 1220 34, 1440 70" />
          <path d="M-40 96 C 260 128, 520 78, 820 108 S 1240 134, 1440 100" />
          <path d="M-40 128 C 240 102, 540 150, 840 120 S 1260 92, 1440 132" />
          <path d="M-40 162 C 280 188, 560 142, 880 172 S 1280 198, 1440 164" />
        </g>
      </svg>

      {/* Compass rose, upper right — fixed pixel size, never cropped or
          stretched by the container's own aspect ratio. */}
      <svg
        viewBox="0 0 200 200"
        className="absolute right-4 top-1 hidden size-[170px] opacity-[0.13] md:block lg:size-[190px]"
      >
        <g transform="translate(100 100)" fill="none" stroke="currentColor">
          <circle r="88" strokeWidth="1" />
          <circle r="64" strokeWidth="0.75" />
          {Array.from({ length: 32 }).map((_, i) => {
            const angle = (i * 360) / 32;
            const long = i % 8 === 0;
            const mid = i % 4 === 0;
            const r1 = 88;
            const r2 = long ? 70 : mid ? 77 : 82;
            const rad = (angle * Math.PI) / 180;
            return (
              <line
                key={angle}
                x1={r1 * Math.sin(rad)}
                y1={-r1 * Math.cos(rad)}
                x2={r2 * Math.sin(rad)}
                y2={-r2 * Math.cos(rad)}
                strokeWidth={long ? 1.1 : 0.6}
              />
            );
          })}
          <path d="M0 -48 L9 0 L0 48 L-9 0 Z" strokeWidth="1.1" />
          <path d="M-48 0 L0 -9 L48 0 L0 9 Z" strokeWidth="0.8" />
          <circle r="4" fill="currentColor" stroke="none" />
          <text x="0" y="-96" textAnchor="middle" fontSize="12" stroke="none" fill="currentColor">
            N
          </text>
          <text x="0" y="108" textAnchor="middle" fontSize="12" stroke="none" fill="currentColor">
            S
          </text>
          <text x="100" y="4" textAnchor="middle" fontSize="12" stroke="none" fill="currentColor">
            E
          </text>
          <text x="-100" y="4" textAnchor="middle" fontSize="12" stroke="none" fill="currentColor">
            W
          </text>
        </g>
      </svg>
    </div>
  );
}
