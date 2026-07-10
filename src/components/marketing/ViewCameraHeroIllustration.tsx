export const ViewCameraHeroIllustration = () => (
  <div className="hero__illustration" aria-hidden="true">
    <svg width="100%" height="320" viewBox="0 0 720 320" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
      <defs>
        <linearGradient id="g1" x1="0" x2="1">
          <stop offset="0" stopColor="#efedff" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="720" height="320" rx="14" fill="url(#g1)" />

      {/* Perspective grid */}
      <g opacity="0.18" stroke="#b8c0ff" strokeWidth="1">
        <path d="M40 240 L680 240" />
        <path d="M120 200 L600 260" />
        <path d="M40 200 L680 260" />
        <path d="M220 120 L520 260" />
      </g>

      {/* Two targets */}
      <g>
        <circle cx="220" cy="210" r="18" fill="#fff" stroke="#c9cff8" strokeWidth="2" />
        <circle cx="360" cy="150" r="28" fill="#fff" stroke="#c9cff8" strokeWidth="2" />
      </g>

      {/* Camera simplified on right */}
      <g transform="translate(520,90)">
        <rect x="0" y="20" width="140" height="80" rx="8" fill="#fff" stroke="#d8dbff" />
        <circle cx="22" cy="60" r="18" fill="#5b4ee8" opacity="0.95" />
        <rect x="38" y="46" width="80" height="28" rx="6" fill="#f4f5ff" />
        <rect x="84" y="74" width="30" height="8" rx="4" fill="#d8dbff" />
      </g>

      {/* Projection / focus plane */}
      <g opacity="0.42">
        <polygon points="320,150 520,130 520,170 320,190" fill="#edeaff" />
      </g>

      {/* Small setting chips */}
      <g transform="translate(32,266)" fontFamily="sans-serif" fontSize="12" fill="#384063">
        <rect x="0" y="0" width="86" height="26" rx="14" fill="#fff" stroke="#e4e7f0" />
        <text x="10" y="17">Rise +8 mm</text>
      </g>
      <g transform="translate(126,266)" fontFamily="sans-serif" fontSize="12" fill="#384063">
        <rect x="0" y="0" width="86" height="26" rx="14" fill="#fff" stroke="#e4e7f0" />
        <text x="10" y="17">Tilt −6°</text>
      </g>
      <g transform="translate(220,266)" fontFamily="sans-serif" fontSize="12" fill="#384063">
        <rect x="0" y="0" width="96" height="26" rx="14" fill="#fff" stroke="#e4e7f0" />
        <text x="10" y="17">Swing +12°</text>
      </g>
      <g transform="translate(332,266)" fontFamily="sans-serif" fontSize="12" fill="#384063">
        <rect x="0" y="0" width="84" height="26" rx="14" fill="#fff" stroke="#e4e7f0" />
        <text x="10" y="17">Focus 2.4 m</text>
      </g>
      <g transform="translate(428,266)" fontFamily="sans-serif" fontSize="12" fill="#384063">
        <rect x="0" y="0" width="68" height="26" rx="14" fill="#fff" stroke="#e4e7f0" />
        <text x="10" y="17">Aperture f/16</text>
      </g>

      <text x="18" y="28" fill="#6b7280" fontSize="12">Ground glass preview</text>
    </svg>
  </div>
);

export default ViewCameraHeroIllustration;
