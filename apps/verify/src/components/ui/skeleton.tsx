/**
 * Skeleton loading placeholder, pulsing rectangle matching content shape.
 * Replaces Loader2 animate-spin spinners throughout the app.
 */
export function Skeleton({
  className = '',
  width,
  height,
}: {
  className?: string;
  width?: string | number;
  height?: string | number;
}) {
  return (
    <span
      className={`inline-block animate-pulse rounded bg-divider/40 ${className}`}
      style={{ width: width ?? '100%', height: height ?? '1em' }}
      aria-hidden="true"
    />
  );
}
