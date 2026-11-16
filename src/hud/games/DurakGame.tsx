import { useEffect, useState } from 'react'
import type { Card as CardT, DurakView } from '../../../shared/games'
import { useRoom } from '../../store/useRoomStore'
import { Card, Log, btnMain, btnSoft, useNames } from './common'

const same = (a: CardT | null, b: CardT) => !!a && a.r === b.r && a.s === b.s

export function DurakGame({ v }: { v: DurakView }) {
  const selfId = useRoom((s) => s.selfId)!
  const act = useRoom((s) => s.gameAction)
  const name = useNames()
  const [selected, setSelected] = useState<CardT | null>(null)

  const isDefender = v.defender === selfId
  const open = v.table.map((p, i) => (!p.d ? i : -1)).filter((i) => i >= 0)
  const allDefended = v.table.length > 0 && open.length === 0
  const canPass = !isDefender && v.table.length > 0 && (v.taken || allDefended) && !v.passed.includes(selfId)

  useEffect(() => setSelected(null), [v.table.length, v.hand.length])

  const playCard = (c: CardT) => {
    if (v.over || v.spectator) return
    if (isDefender) {
      if (v.taken) return
      // Одна неотбитая карта — кроем сразу; иначе ждём выбора карты на столе
      if (open.length === 1) act({ type: 'defend', index: open[0], card: c })
      else setSelected(same(selected, c) ? null : c)
      return
    }
    act({ type: 'attack', card: c })
  }

  const hint = v.over
    ? v.result
    : v.spectator
      ? 'Вы смотрите партию'
      : isDefender
        ? v.taken ? 'Вы берёте. Ждём, пока подкинут' : open.length ? (open.length > 1 && selected ? 'Теперь нажмите карту на столе, которую кроете' : 'Отбивайтесь: нажмите карту, которой кроете') : 'Отбились. Ждём подкидных или «Бито»'
        : v.table.length === 0
          ? v.attacker === selfId ? 'Ваш ход: нажмите карту' : `Ходит ${name(v.attacker)}`
          : 'Подкиньте карту того же достоинства или нажмите «Пас»'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Соперники */}
      <div className="flex flex-wrap gap-1.5">
        {v.players.filter((p) => p.id !== selfId).map((p) => (
          <div key={p.id} className={`rounded-xl px-3 py-1.5 text-xs ${p.out ? 'opacity-50' : 'bg-white/6'} ${p.id === v.defender ? 'ring-1 ring-alarm/60' : p.id === v.attacker ? 'ring-1 ring-mint/60' : ''}`}>
            <span className="font-semibold">{name(p.id)}</span> <span className="text-fog">{p.badge}</span>
          </div>
        ))}
      </div>

      {/* Стол */}
      <div className="flex min-h-0 flex-1 items-center gap-4 rounded-2xl bg-[#1d4a3a]/60 p-3 ring-1 ring-white/10">
        <div className="flex shrink-0 flex-col items-center gap-1 text-xs text-fog">
          <div className="flex items-center gap-1">
            {v.deck > 1 && <Card small label={`Колода: ${v.deck}`} />}
            <Card card={v.trump} small label={`Козырь ${v.trump.s}, лежит под колодой`} />
          </div>
          <span>Колода: {v.deck}</span>
          <span>Козырь {v.trump.s}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap content-center gap-3" aria-label="Стол">
          {v.table.length === 0 && <p className="text-sm text-fog">Стол пуст</p>}
          {v.table.map((pair, i) => (
            <div key={i} className="relative h-20 w-14">
              <Card
                card={pair.a}
                small
                onClick={isDefender && !pair.d && selected ? () => act({ type: 'defend', index: i, card: selected }) : undefined}
                label={`${pair.a.r}${pair.a.s}${pair.d ? ', покрыта' : isDefender ? ', нажмите, чтобы покрыть' : ''}`}
              />
              {pair.d && <div className="absolute top-3 left-3"><Card card={pair.d} small /></div>}
            </div>
          ))}
        </div>
      </div>

      <p className="text-sm font-semibold" role="status">{hint}</p>

      {/* Рука */}
      {!v.spectator && (
        <div className="flex items-end gap-2 overflow-x-auto pb-2 pt-3" aria-label="Ваши карты">
          {v.hand.map((c) => (
            <Card key={`${c.r}${c.s}`} card={c} selected={same(selected, c)} onClick={v.over ? undefined : () => playCard(c)} />
          ))}
          {v.hand.length === 0 && <p className="text-sm text-fog">Карт нет</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {isDefender && !v.over && (
          <button className={btnSoft} onClick={() => act({ type: 'take' })} disabled={v.taken || open.length === 0}>Беру</button>
        )}
        {!isDefender && !v.spectator && !v.over && (
          <button className={btnMain} onClick={() => act({ type: 'pass' })} disabled={!canPass}>
            {v.taken ? 'Пас' : 'Бито'}
          </button>
        )}
        <div className="flex-1" />
      </div>
      <Log lines={v.log} />
    </div>
  )
}
