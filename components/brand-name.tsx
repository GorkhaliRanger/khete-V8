export function BrandName({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-word ${className}`.trim()} aria-label="khetE">
      <span aria-hidden="true">khet<span className="brand-word-e">E</span></span>
    </span>
  );
}
