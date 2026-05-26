import clsx from 'clsx';

type Size = 'hero' | 'lg' | 'md' | 'sm';

const SIZE_CLASSES: Record<Size, string> = {
  hero: 'text-7xl sm:text-8xl md:text-9xl',
  lg: 'text-5xl',
  md: 'text-3xl',
  sm: 'text-xl',
};

/**
 * The Atrium wordmark — serif italic with a horizontal underline.
 * Matches the logo treatment in design/Atrium.html.
 */
export function Wordmark({ size = 'md' }: { size?: Size }) {
  return (
    <span className={clsx('wordmark', SIZE_CLASSES[size])} aria-label="Atrium">
      Atrium
    </span>
  );
}
