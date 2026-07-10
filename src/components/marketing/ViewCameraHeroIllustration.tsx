export const ViewCameraHeroIllustration = () => (
  <div className="hero__illustration" aria-hidden="true">
    <svg viewBox="0 0 640 440" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="bg" x1="0" x2="1">
          <stop offset="0" stop-color="#fbfbff" />
          <stop offset="1" stop-color="#f4f5ff" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="640" height="440" rx="18" fill="url(#bg)" />

      {/* floor grid */}
      <g opacity="0.12" stroke="#dfe6ff" stroke-width="1">
        <path d="M20 360 L620 360" />
        <path d="M40 320 L600 360" />
        <path d="M20 300 L620 360" />
        <path d="M140 220 L500 360" />
      </g>

      {/* targets */}
      <g>
        <circle cx="160" cy="280" r="16" fill="#fff" stroke="#d3d7ff" stroke-width="2" />
        <circle cx="260" cy="210" r="26" fill="#fff" stroke="#c9cff8" stroke-width="2" />
      </g>

      {/* projection plane */}
      <g opacity="0.32">
        <polygon points="280,220 480,200 480,240 280,260" fill="#ebeaff" />
      </g>

      {/* camera on tripod with standards and bellows */}
      <g transform="translate(420,120)">
        <g>
          {/* tripod legs */}
          <path d="M40 220 L10 360" stroke="#bfc7e9" stroke-width="6" stroke-linecap="round" />
          <path d="M60 220 L120 360" stroke="#bfc7e9" stroke-width="6" stroke-linecap="round" />
          <path d="M50 220 L60 360" stroke="#bfc7e9" stroke-width="6" stroke-linecap="round" />

          {/* rear standard */}
          <rect x="-6" y="0" width="12" height="140" rx="3" fill="#f8f8ff" stroke="#d8dbff" />
          <rect x="-16" y="40" width="32" height="20" rx="4" fill="#eef0ff" stroke="#e0e4ff" />

          {/* bellows (rectilinear pattern) */}
          <g transform="translate(0,60)">
            <rect x="12" y="0" width="90" height="30" rx="6" fill="#f4f5ff" stroke="#e1e4ff" />
            <g stroke="#d0d6ff" opacity="0.8">
              <path d="M18 6 L18 24" />
              <path d="M30 6 L30 24" />
              <path d="M42 6 L42 24" />
              <path d="M54 6 L54 24" />
              <path d="M66 6 L66 24" />
              <path d="M78 6 L78 24" />
            </g>
          </g>

          {/* front standard & lens */}
          <g transform="translate(112,50)">
            <rect x="0" y="0" width="28" height="90" rx="4" fill="#fff" stroke="#d8dbff" />
            <circle cx="14" cy="42" r="18" fill="#5b4ee8" opacity="0.95" />
            <circle cx="14" cy="42" r="8" fill="#fff" />
          </g>
        </g>
      </g>

      {/* chips */}
      <g transform="translate(20,380)" font-family="sans-serif" font-size="12" fill="#384063">
        <g transform="translate(0,0)">
          <rect x="0" y="0" width="96" height="28" rx="14" fill="#fff" stroke="#e4e7f0" />
          <text x="12" y="18">Rise +8 mm</text>
        </g>
        <g transform="translate(110,0)">
          <rect x="0" y="0" width="84" height="28" rx="14" fill="#fff" stroke="#e4e7f0" />
          <text x="12" y="18">Tilt −6°</text>
        </g>
        <g transform="translate(210,0)">
          <rect x="0" y="0" width="84" height="28" rx="14" fill="#fff" stroke="#e4e7f0" />
          <text x="12" y="18">Swing +12°</text>
        </g>
        <g transform="translate(310,0)">
          <rect x="0" y="0" width="84" height="28" rx="14" fill="#fff" stroke="#e4e7f0" />
          <text x="12" y="18">Focus 2.4 m</text>
        </g>
        <g transform="translate(410,0)">
          <rect x="0" y="0" width="84" height="28" rx="14" fill="#fff" stroke="#e4e7f0" />
          <text x="12" y="18">Aperture f/16</text>
        </g>
      </g>

      <text x="18" y="24" fill="#6b7280" font-size="12">Ground glass preview</text>
    </svg>
  </div>
);

export default ViewCameraHeroIllustration;
