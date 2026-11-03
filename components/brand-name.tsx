/* eslint-disable @next/next/no-img-element -- inline brand logo must scale with the surrounding text. */
export function BrandName({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-word ${className}`.trim()} aria-label="khetE" role="img">
      <img className="brand-word-default" src="/brand/khet-e-logo.png" alt="" />
      <img className="brand-word-inverse" src="/brand/khet-e-logo-white.png" alt="" />
    </span>
  );
}
