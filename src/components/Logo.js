export function LogoMark({ size = 32, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M4 11V8a4 4 0 0 1 4-4h3M21 4h3a4 4 0 0 1 4 4v3M28 21v3a4 4 0 0 1-4 4h-3M11 28H8a4 4 0 0 1-4-4v-3" stroke="#1aa7c4" strokeWidth="3" strokeLinecap="round" />
      <path d="M9 16h14" stroke="#1f3556" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ size = 32, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      <span className="font-semibold tracking-tight text-navy" style={{ fontSize: size * 0.75, lineHeight: 1 }}>
        neatx-ray
      </span>
    </span>
  );
}
