import { X } from 'lucide-react'
import { GAMES, gameInfo } from '../../shared/games'
import { useRoom } from '../store/useRoomStore'
import { btnMain, btnSoft, useNames } from './games/common'
import { DurakGame } from './games/DurakGame'
import { PikDamaGame } from './games/PikDamaGame'
import { MafiaGame } from './games/MafiaGame'
import { BunkerGame } from './games/BunkerGame'

/** Игры: любой предлагает, главный начинает. Во время игры — её экран. */
export function GamesPanel() {
  const game = useRoom((s) => s.game)
  const proposals = useRoom((s) => s.proposals)
  const selfId = useRoom((s) => s.selfId)!
  const isHost = useRoom((s) => s.participants.find((p) => p.id === s.selfId)?.isHost ?? false)
  const count = useRoom((s) => s.participants.filter((p) => p.status !== 'leaving').length)
  const { proposeGame, startGame, stopGame, setPanel } = useRoom.getState()
  const name = useNames()

  return (
    <section className="glass pointer-events-auto flex h-full min-h-0 w-full flex-col gap-3 rounded-3xl p-3 sm:p-4" aria-label="Игры">
      <header className="flex items-center gap-2">
        <h2 className="font-display text-base font-bold">
          {game ? `${gameInfo(game.gameId).emoji} ${gameInfo(game.gameId).title}` : 'Во что сыграем?'}
        </h2>
        <div className="flex-1" />
        {game && isHost && (
          <button className={btnSoft} onClick={stopGame}>{game.over ? 'Закрыть игру' : 'Завершить игру'}</button>
        )}
        <button onClick={() => setPanel('none')} className="rounded-lg p-2 text-fog hover:bg-white/10 hover:text-paper" aria-label="Свернуть панель">
          <X className="size-5" />
        </button>
      </header>

      {game ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {game.spectator && <p className="mb-2 text-xs text-fog">Вы вошли после начала и смотрите игру.</p>}
          {game.gameId === 'durak' && <DurakGame v={game} />}
          {game.gameId === 'pikdama' && <PikDamaGame v={game} />}
          {game.gameId === 'mafia' && <MafiaGame v={game} isHost={isHost} />}
          {game.gameId === 'bunker' && <BunkerGame v={game} isHost={isHost} />}
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          <p className="text-sm text-fog">
            {isHost
              ? 'Вы главный: начните игру сами или посмотрите, что предлагают остальные.'
              : 'Предложите игру. Начинает главный, когда соберётся достаточно игроков.'}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {GAMES.map((g) => {
              const by = proposals.find((p) => p.gameId === g.id)?.by ?? []
              const mine = by.includes(selfId)
              const enough = count >= g.min && count <= g.max
              return (
                <article key={g.id} className={`flex flex-col gap-2 rounded-2xl bg-ink-2/70 p-3 ring-1 ${by.length ? 'ring-brass/60' : 'ring-white/10'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-3xl" aria-hidden>{g.emoji}</span>
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-bold">{g.title}</h3>
                      <p className="text-xs text-fog">{g.description}</p>
                      <p className="mt-1 text-[11px] text-fog/80">Игроков: {g.min}–{g.max}</p>
                    </div>
                  </div>
                  {by.length > 0 && (
                    <p className="text-xs text-brass">Предлагают: {by.map((id) => (id === selfId ? 'вы' : name(id))).join(', ')}</p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-2">
                    {isHost ? (
                      <button className={btnMain} onClick={() => startGame(g.id)} disabled={!enough}>
                        Начать
                      </button>
                    ) : (
                      <button className={mine ? btnSoft : btnMain} onClick={() => proposeGame(g.id)} aria-pressed={mine}>
                        {mine ? 'Отменить предложение' : 'Предложить'}
                      </button>
                    )}
                    {!enough && <span className="self-center text-[11px] text-fog">Сейчас за столом {count}</span>}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
