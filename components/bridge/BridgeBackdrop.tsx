/**
 * The portal's topographic contour artwork, without the compass rose: the
 * bridge page carries no marks or logos, only the same paper-and-ink
 * texture, faded out before the video card so it never competes with it.
 */
export function BridgeBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden text-[#0b1a35]"
      style={{
        maskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 100%)",
      }}
    >
      <svg
        viewBox="0 0 1400 420"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full opacity-[0.07]"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M-40 40 C 220 8, 460 70, 720 34 S 1180 4, 1440 44" />
          <path d="M-40 84 C 200 58, 480 118, 760 76 S 1220 46, 1440 92" />
          <path d="M-40 130 C 260 168, 520 106, 820 146 S 1240 178, 1440 134" />
          <path d="M-40 176 C 240 142, 540 204, 840 164 S 1260 128, 1440 180" />
          <path d="M-40 224 C 280 258, 560 196, 880 238 S 1280 272, 1440 226" />
          <path d="M-40 272 C 230 244, 520 302, 800 262 S 1230 232, 1440 276" />
          <path d="M-40 322 C 270 352, 540 294, 860 334 S 1270 364, 1440 320" />
          <path d="M-40 372 C 250 344, 530 400, 830 362 S 1250 330, 1440 376" />
        </g>
      </svg>
    </div>
  );
}
