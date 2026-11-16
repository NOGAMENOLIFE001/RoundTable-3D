import { useEffect, useState } from 'react'
import { Crown, Hand, MicOff, MonitorUp, Video } from 'lucide-react'
import { useRoom } from '../store/useRoomStore'
import { participantLevel } from '../lib/media'
import { SEAT_COUNT } from '../lib/seats'

/** Кто за столом — всегда на виду слева: говорит ли, рука, главный, статус в игре */
export function Roster() {
  const participants = useRoom((s) => s.participants)
  const selfId = useRoom((s) => s.selfId)
  const game = useRoom((s) => s.game)
  const presenter = useRoom((s) => (s.stage.mode === 'screen' ? s.stage.presenterId : null))
  const [, tick] = useState(0)
  const [open, setOpen] = useState(() => window.innerWidth >= 640)

  // Подсветка говорящих: обновляем несколько раз в секунду
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 150)
    return () => clearInterval(t)
  }, [])

  const now = performance.now() / 1000
  const list = [...participants].filter((p) => p.status !== 'leaving').sort((a, b) => a.seat - b.seat)
  const badge = (id: string) => game?.players.find((p) => p.id === id)

  return (
    <aside className="glass pointer-events-auto w-fit max-w-[230px] rounded-2xl p-1.5" aria-label="Участники">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-fog hover:text-paper"
        aria-expanded={open}
      >
        За столом <span className="tabular-nums text-paper">{list.length}/{SEAT_COUNT}</span>
      </button>
      <ul className={`${open ? 'mt-1' : 'hidden'} max-h-[50vh] space-y-0.5 overflow-y-auto`}>
        {list.map((p) => {
          const speaking = participantLevel(p, now) > 0.12
          const b = badge(p.id)
          return (
            <li key={p.id} className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 ${b?.out ? 'opacity-50' : ''}`}>
              <span
                className="relative flex size-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-ink transition-shadow"
                style={{ background: p.color, boxShadow: speaking ? `0 0 0 3px #0E1726, 0 0 0 5px ${p.color}` : undefined }}
                aria-label={speaking ? 'Говорит' : undefined}
              >
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-semibold">
                  <span className="truncate">{p.name}</span>
                  {p.isHost && <Crown className="size-3.5 shrink-0 text-brass" aria-label="Главный" />}
                </p>
                <p className="truncate text-[11px] text-fog">
                  {p.id === selfId ? 'вы · ' : ''}
                  {b?.badge ?? (p.status === 'entering' ? 'идёт к столу' : `место ${p.seat + 1}`)}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-fog">
                {p.handRaised && <Hand className="size-3.5 text-brass" aria-label="Рука поднята" />}
                {presenter === p.id && <MonitorUp className="size-3.5 text-mint" aria-label="Показывает экран" />}
                {p.camOn && <Video className="size-3.5 text-mint" aria-label="Камера включена" />}
                {!p.micOn && <MicOff className="size-3.5" aria-label="Микрофон выключен" />}
              </span>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
