export const TwoTargetsThumbnail = () => (
  <div className="scene-thumb" aria-hidden="true">
    <svg width="100%" height="100%" viewBox="0 0 360 240" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="360" height="240" rx="12" fill="url(#gthumb)" />
      <defs>
        <linearGradient id="gthumb" x1="0" x2="1">
          <stop offset="0" stopColor="#f7f8fc" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
      </defs>

      <g opacity="0.6" stroke="#d7dcff">
        <path d="M10 200 L350 200" />
        <path d="M40 160 L320 200" />
      </g>

      <g>
        <circle cx="120" cy="170" r="12" fill="#fff" stroke="#c9cff8" />
        <circle cx="220" cy="120" r="18" fill="#fff" stroke="#c9cff8" />
      </g>

      <g>
        <rect x="20" y="20" width="60" height="8" rx="4" fill="#f1f1ff" />
        <rect x="20" y="36" width="120" height="6" rx="3" fill="#f1f1ff" />
      </g>
    </svg>
  </div>
);

export default TwoTargetsThumbnail;
