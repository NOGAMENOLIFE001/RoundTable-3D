import type { Card as CardT } from '../../../shared/games'
import { RANK_LABEL, isRed } from '../../../shared/games'
import { useRoom } from '../../store/useRoomStore'

/** Игральная карта. size: обычная (в руке) или маленькая (на столе, у соперников) */
export function Card({
  card, onClick, selected, disabled, small, label,
}: { card?: CardT; onClick?: () => void; selected?: boolean; disabled?: boolean; small?: boolean; label?: string }) {
  const sz = small ? 'h-16 w-11 text-sm' : 'h-24 w-16 text-lg sm:h-28 sm:w-[76px]'
  if (!card) {
    // Рубашка
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || !onClick}
        aria-label={label ?? 'Карта рубашкой вверх'}
        className={`${sz} shrink-0 rounded-xl bg-[repeating-linear-gradient(45deg,#1b2a4a_0_6px,#24365c_6px_12px)] ring-2 ring-brass/60 transition enabled:hover:-translate-y-2 enabled:hover:ring-mint disabled:cursor-default`}
      />
    )
  }
  const red = isRed(card.s)
  const text = `${RANK_LABEL[card.r]}${card.s}`
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-label={label ?? text}
      aria-pressed={selected}
      className={`${sz} relative flex shrink-0 flex-col justify-between rounded-xl bg-[#F7F4EC] p-1.5 font-bold shadow-lg transition disabled:cursor-default ${
        red ? 'text-[#C9243F]' : 'text-[#141A26]'
      } ${selected ? '-translate-y-3 ring-4 ring-mint' : 'enabled:hover:-translate-y-2'}`}
    >
      <span className="leading-none">{RANK_LABEL[card.r]}</span>
      <span className={`self-center ${small ? 'text-xl' : 'text-3xl'} leading-none`}>{card.s}</span>
      <span className="rotate-180 leading-none">{RANK_LABEL[card.r]}</span>
    </button>
  )
}

/** Имя участника по id */
export function useNames() {
  const participants = useRoom((s) => s.participants)
  return (id: string) => participants.find((p) => p.id === id)?.name ?? 'Игрок'
}

export function Log({ lines }: { lines: string[] }) {
  return (
    <ol className="max-h-28 space-y-0.5 overflow-y-auto text-xs text-fog" aria-label="Ход игры" aria-live="polite">
      {lines.slice(-6).map((l, i) => (
        <li key={i} className={i === Math.min(lines.length, 6) - 1 ? 'text-paper' : ''}>{l}</li>
      ))}
    </ol>
  )
}

export const btn = 'rounded-xl px-4 py-2 text-sm font-bold transition disabled:opacity-40'
export const btnMain = `${btn} bg-mint text-ink hover:brightness-110`
export const btnSoft = `${btn} bg-white/10 text-paper hover:bg-white/18`

/** Кнопки выбора игрока (цель ночью, голосование) */
export function PlayerPicker({
  ids, selected, onPick, disabled, extra,
}: { ids: string[]; selected: string | null; onPick: (id: string) => void; disabled?: (id: string) => boolean; extra?: (id: string) => React.ReactNode }) {
  const name = useNames()
  const participants = useRoom((s) => s.participants)
  const color = (id: string) => participants.find((p) => p.id === id)?.color ?? '#A9B6CC'
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <button
          key={id}
          onClick={() => onPick(id)}
          disabled={disabled?.(id)}
          aria-pressed={selected === id}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-35 ${
            selected === id ? 'bg-paper text-ink' : 'bg-white/8 hover:bg-white/15'
          }`}
        >
          <span className="size-2.5 rounded-full" style={{ background: color(id) }} />
          {name(id)}
          {extra?.(id)}
        </button>
      ))}
    </div>
  )
}
