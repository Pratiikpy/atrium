import type { CSSProperties } from "react";

export function BrandWordmark({
  size = 22,
  className = "",
  style,
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`atrium-mark ${className}`}
      style={{ fontSize: size, lineHeight: 1, ...style }}
    >
      Atrium
    </span>
  );
}

export function AppIcon({
  size = 64,
  status = "testnet",
}: {
  size?: number;
  status?: "testnet" | "healthy" | "critical";
}) {
  const barColor =
    status === "healthy" ? "#43864F" : status === "critical" ? "#A1352A" : "#CC8E2D";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="Atrium app icon">
      <rect width="64" height="64" rx="14" fill="#1A1714" />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontFamily="'Instrument Serif', Georgia, serif"
        fontStyle="italic"
        fontWeight={600}
        fontSize={44}
        fill="#FBFAF7"
      >
        A
      </text>
      <rect x="10" y="48" width="44" height="6" rx="2" fill={barColor} opacity={0.95} />
    </svg>
  );
}
