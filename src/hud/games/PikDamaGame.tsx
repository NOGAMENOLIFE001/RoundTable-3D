import type { PikDamaView } from '../../../shared/games'
import { useRoom } from '../../store/useRoomStore'
import { Card, Log, useNames } from './common'

export function PikDamaGame({ v }: { v: PikDamaView }) {
  const selfId = useRoom((s) => s.selfId)!
  const act = useRoom((s) => s.gameAction)
  const name = useNames()
  const myTurn = v.turn === selfId && !v.over
  const fromCount = v.counts[v.from] ?? 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {v.players.filter((p) => p.id !== selfId).map((p) => (
          <div key={p.id} className={`rounded-xl px-3 py-1.5 text-xs ${p.out ? 'opacity-50' : 'bg-white/6'} ${p.id === v.turn ? 'ring-1 ring-mint/60' : ''}`}>
            <span className="font-semibold">{name(p.id)}</span> <span className="text-fog">{p.badge}</span>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 rounded-2xl bg-[#1d4a3a]/60 p-3 ring-1 ring-white/10">
        <p className="text-sm font-semibold" role="status">
          {v.over ? v.result : myTurn ? `Ваш ход: вытяните карту у игрока ${name(v.from)}` : `${name(v.turn)} тянет карту у игрока ${name(v.from)}`}
        </p>
        {!v.over && (
          <div className="flex flex-wrap gap-1.5" aria-label={`Карты игрока ${name(v.from)}`}>
            {Array.from({ length: fromCount }, (_, i) => (
              <Card key={i} small onClick={myTurn ? () => act({ type: 'draw', index: i }) : undefined} label={`Вытянуть карту ${i + 1}`} />
            ))}
          </div>
        )}
        {v.drawn && (
          <p className="flex items-center gap-2 text-xs text-fog">
            Последняя вытянутая вами карта: <Card card={v.drawn} small />
          </p>
        )}
      </div>

      {!v.spectator && (
        <div className="flex items-end gap-2 overflow-x-auto pb-2 pt-3" aria-label="Ваши карты">
          {v.hand.map((c) => (
            <Card key={`${c.r}${c.s}`} card={c} />
          ))}
          {v.hand.length === 0 && <p className="text-sm text-fog">Вы избавились от всех карт</p>}
        </div>
      )}
      <Log lines={v.log} />
    </div>
  )
}
