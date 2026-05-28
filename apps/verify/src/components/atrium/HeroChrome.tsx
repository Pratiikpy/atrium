export function BlueprintGrid() {
  return (
    <svg className="hero-grid" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <pattern id="bp-minor" patternUnits="userSpaceOnUse" width="48" height="48">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.4" opacity="0.04" />
        </pattern>
        <pattern id="bp-major" patternUnits="userSpaceOnUse" width="192" height="192">
          <path d="M 192 0 L 0 0 0 192" fill="none" stroke="white" strokeWidth="0.6" opacity="0.06" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bp-minor)" />
      <rect width="100%" height="100%" fill="url(#bp-major)" />
    </svg>
  );
}

export function Vignette() {
  return <div className="hero-vignette" aria-hidden="true" />;
}
