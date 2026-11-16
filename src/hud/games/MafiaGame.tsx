import type { MafiaRole, MafiaView } from '../../../shared/games'
import { useRoom } from '../../store/useRoomStore'
import { Log, PlayerPicker, btnMain, useNames } from './common'

const ROLE: Record<MafiaRole, { title: string; emoji: string; text: string }> = {
  mafia: { title: 'Мафия', emoji: '🕶️', text: 'Ночью вместе с другими мафиози выберите жертву. Днём не выдайте себя.' },
  sheriff: { title: 'Шериф', emoji: '⭐', text: 'Каждую ночь проверяйте одного игрока: мафия он или нет.' },
  doctor: { title: 'Доктор', emoji: '💉', text: 'Каждую ночь выберите, кого спасти. Можно и себя.' },
  civilian: { title: 'Мирный житель', emoji: '🏠', text: 'Ночью спите. Днём ищите мафию и голосуйте.' },
}

const PHASE = { night: '🌙 Ночь', day: '☀️ День: обсуждение', vote: '🗳 Голосование' }

export function MafiaGame({ v, isHost }: { v: MafiaView; isHost: boolean }) {
  const selfId = useRoom((s) => s.selfId)!
  const act = useRoom((s) => s.gameAction)
  const name = useNames()
  const alive = v.alive.includes(selfId)
  const role = v.role ? ROLE[v.role] : null

  const nightTargets = v.alive.filter((id) => {
    if (v.role === 'mafia') return !v.team.includes(id)
    if (v.role === 'sheriff') return id !== selfId && !(id in v.checks)
    return true
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-xl bg-white/8 px-3 py-1.5 text-sm font-bold">{PHASE[v.phase]} · день {v.round}</span>
        {v.phase === 'night' && <span className="text-xs text-fog">Ждём ночных ходов: {v.waiting}</span>}
        <div className="flex-1" />
        {isHost && !v.over && (
          <button className={btnMain} onClick={() => act({ type: 'advance' })}>
            {v.phase === 'night' ? 'Наступает утро' : v.phase === 'day' ? 'К голосованию' : 'Подвести итоги'}
          </button>
        )}
      </div>

      {role && !v.spectator && (
        <div className="flex items-start gap-3 rounded-2xl bg-ink-2/70 p-3 ring-1 ring-white/10">
          <span className="text-3xl" aria-hidden>{role.emoji}</span>
          <div>
            <p className="font-display font-bold">Ваша роль: {role.title}{!alive && ' (выбыли)'}</p>
            <p className="text-sm text-fog">{role.text}</p>
            {v.team.length > 1 && <p className="mt-1 text-sm">Ваша команда: {v.team.map(name).join(', ')}</p>}
            {Object.keys(v.checks).length > 0 && (
              <p className="mt-1 text-sm">
                Проверки: {Object.entries(v.checks).map(([id, m]) => `${name(id)} — ${m ? 'мафия' : 'не мафия'}`).join('; ')}
              </p>
            )}
          </div>
        </div>
      )}

      {v.over ? (
        <p className="rounded-2xl bg-white/8 p-3 text-center font-display text-lg font-bold" role="status">{v.result}</p>
      ) : alive && !v.spectator && v.phase === 'night' && v.role !== 'civilian' ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">
            {v.role === 'mafia' ? 'Кого устраняем?' : v.role === 'doctor' ? 'Кого спасаем?' : 'Кого проверяем?'}
            {v.mafiaTarget && <span className="ml-2 font-normal text-fog">Выбор команды: {name(v.mafiaTarget)}</span>}
          </p>
          <PlayerPicker ids={nightTargets} selected={v.myTarget} onPick={(id) => act({ type: 'night', target: id })} />
        </div>
      ) : alive && !v.spectator && v.phase === 'night' ? (
        <p className="text-sm text-fog">Город спит. Закройте глаза и ждите утра.</p>
      ) : v.phase === 'day' ? (
        <p className="text-sm text-fog">Обсуждайте голосом. Когда будете готовы, главный начнёт голосование.</p>
      ) : alive && !v.spectator ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Кого исключаем?</p>
          <PlayerPicker
            ids={v.alive.filter((id) => id !== selfId)}
            selected={v.myTarget}
            onPick={(id) => act({ type: 'vote', target: id })}
            extra={(id) => {
              const n = Object.values(v.votes).filter((t) => t === id).length
              return n ? <span className="rounded-full bg-alarm/80 px-1.5 text-[11px] text-ink">{n}</span> : null
            }}
          />
          <button className="text-sm text-fog underline-offset-4 hover:underline" onClick={() => act({ type: 'vote', target: null })}>
            Воздержаться
          </button>
        </div>
      ) : (
        <p className="text-sm text-fog">Вы выбыли — можно наблюдать, но не голосовать.</p>
      )}

      {Object.keys(v.revealed).length > 0 && (
        <p className="text-xs text-fog">
          Раскрыты: {Object.entries(v.revealed).map(([id, r]) => `${name(id)} — ${ROLE[r].title.toLowerCase()}`).join(', ')}
        </p>
      )}
      <Log lines={v.log} />
    </div>
  )
}
