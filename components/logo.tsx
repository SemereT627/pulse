// Pulse mark: seven bars, one per day of the report week, peaking mid-week.
const BARS = [
  { x: 2.5, y: 22, h: 4, o: 0.4 },
  { x: 9, y: 20, h: 8, o: 0.55 },
  { x: 15.5, y: 16, h: 16, o: 0.8 },
  { x: 22, y: 6, h: 36, o: 1 },
  { x: 28.5, y: 13, h: 22, o: 0.8 },
  { x: 35, y: 19, h: 10, o: 0.55 },
  { x: 41.5, y: 22, h: 4, o: 0.4 },
];

export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={`text-accent ${className}`} aria-hidden="true">
      {BARS.map((b) => (
        <rect key={b.x} x={b.x} y={b.y} width="4" height={b.h} rx="2" fill="currentColor" opacity={b.o} />
      ))}
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="font-display text-xl font-bold leading-none tracking-[-0.045em]">pulse</span>
    </span>
  );
}
