/** Знак: стол сверху — кольцо из восьми мест */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className={compact ? 'size-6' : 'size-8'} aria-hidden>
        <circle cx="16" cy="16" r="7" fill="#6B4A33" stroke="#5EF2C7" strokeWidth="1.5" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2
          return <circle key={i} cx={16 + Math.sin(a) * 12.5} cy={16 + Math.cos(a) * 12.5} r="2.2" fill={i === 0 ? '#E0B15C' : '#A9B6CC'} />
        })}
      </svg>
      <span className={`font-display font-bold tracking-tight ${compact ? 'text-sm' : 'text-lg'}`}>RoundTable</span>
    </div>
  )
}
