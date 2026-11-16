import { BUNKER_TRAITS, type BunkerView } from '../../../shared/games'
import { useRoom } from '../../store/useRoomStore'
import { Log, PlayerPicker, btnMain, useNames } from './common'

export function BunkerGame({ v, isHost }: { v: BunkerView; isHost: boolean }) {
  const selfId = useRoom((s) => s.selfId)!
  const act = useRoom((s) => s.gameAction)
  const name = useNames()
  const alive = v.alive.includes(selfId)
  const myOpen = v.open[selfId] ?? {}
  const revealed = v.revealedThisRound.includes(selfId)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl bg-alarm/12 p-3 ring-1 ring-alarm/30">
          <p className="text-xs font-semibold text-fog">Катастрофа</p>
          <p className="text-sm">{v.catastrophe}</p>
        </div>
        <div className="rounded-2xl bg-mint/10 p-3 ring-1 ring-mint/30">
          <p className="text-xs font-semibold text-fog">Бункер · мест: {v.places}</p>
          <p className="text-sm">{v.bunker}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-xl bg-white/8 px-3 py-1.5 text-sm font-bold">
          Раунд {v.round} · {v.phase === 'reveal' ? 'раскрытие' : 'голосование'}
        </span>
        <span className="text-xs text-fog">В игре: {v.alive.length}</span>
        <div className="flex-1" />
        {isHost && !v.over && (
          <button className={btnMain} onClick={() => act({ type: 'advance' })}>
            {v.phase === 'reveal' ? 'К голосованию' : 'Подвести итоги'}
          </button>
        )}
      </div>

      {v.over && <p className="rounded-2xl bg-white/8 p-3 text-center font-display text-lg font-bold" role="status">{v.result}</p>}

      {/* Моя карточка */}
      {!v.spectator && (
        <div className="rounded-2xl bg-ink-2/70 p-3 ring-1 ring-white/10">
          <p className="mb-2 text-sm font-semibold">
            Ваша карточка {alive ? '' : '(вы вне бункера)'}
            {alive && v.phase === 'reveal' && !revealed && !v.over && (
              <span className="ml-2 font-normal text-mint">{v.round === 1 ? 'Раскройте профессию' : 'Нажмите характеристику, чтобы раскрыть её всем'}</span>
            )}
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {BUNKER_TRAITS.map((t) => {
              const isOpen = !!myOpen[t.id]
              const canReveal = alive && !v.over && v.phase === 'reveal' && !revealed && !isOpen && (v.round > 1 || t.id === 'job')
              return (
                <button
                  key={t.id}
                  disabled={!canReveal}
                  onClick={() => act({ type: 'reveal', trait: t.id })}
                  className={`rounded-xl px-3 py-2 text-left text-sm transition ${isOpen ? 'bg-mint/15 ring-1 ring-mint/40' : 'bg-white/6'} ${canReveal ? 'hover:bg-white/14 ring-1 ring-brass/50' : ''}`}
                >
                  <span className="block text-[11px] text-fog">{t.label}{isOpen ? ' · открыто' : ''}</span>
                  {v.mine[t.id]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Что известно о других */}
      <div className="space-y-1.5">
        {v.players.filter((p) => p.id !== selfId).map((p) => {
          const open = v.open[p.id] ?? {}
          return (
            <div key={p.id} className={`rounded-xl bg-white/5 px-3 py-2 text-sm ${p.out ? 'opacity-50' : ''}`}>
              <span className="font-semibold">{name(p.id)}</span> <span className="text-xs text-fog">{p.badge}</span>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
                {BUNKER_TRAITS.filter((t) => open[t.id]).map((t) => (
                  <span key={t.id}><span className="text-fog">{t.label}:</span> {open[t.id]}</span>
                ))}
                {!Object.keys(open).length && <span className="text-fog">пока ничего не раскрыто</span>}
              </div>
            </div>
          )
        })}
      </div>

      {alive && !v.over && v.phase === 'vote' && !v.spectator && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Кто не попадает в бункер?</p>
          <PlayerPicker
            ids={v.alive.filter((id) => id !== selfId)}
            selected={v.votes[selfId] ?? null}
            onPick={(id) => act({ type: 'vote', target: id })}
            extra={(id) => {
              const n = Object.values(v.votes).filter((t) => t === id).length
              return n ? <span className="rounded-full bg-alarm/80 px-1.5 text-[11px] text-ink">{n}</span> : null
            }}
          />
        </div>
      )}
      <Log lines={v.log} />
    </div>
  )
}
