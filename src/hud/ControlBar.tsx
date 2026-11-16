import { useEffect, useRef, useState } from 'react'
import { Gamepad2, Hand, LogOut, Mic, MicOff, Presentation, Smile, Video, VideoOff } from 'lucide-react'
import { useRoom } from '../store/useRoomStore'
import { REACTIONS } from '../lib/misc'

const base = 'relative flex size-10 items-center justify-center rounded-2xl transition disabled:opacity-40 sm:size-12'
const off = 'bg-white/8 text-paper hover:bg-white/15'

export function ControlBar() {
  const me = useRoom((s) => s.participants.find((p) => p.id === s.selfId))
  const { setMic, setCam, toggleHand, react, leaveRoom, setPanel } = useRoom.getState()
  const panel = useRoom((s) => s.panel)
  const stageLive = useRoom((s) => s.stage.mode !== 'none')
  const gameLive = useRoom((s) => !!s.game)
  const proposals = useRoom((s) => s.proposals.reduce((n, p) => n + p.by.length, 0))
  const [emojiOpen, setEmojiOpen] = useState(false)
  const pop = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!emojiOpen) return
    const close = (e: PointerEvent) => !pop.current?.contains(e.target as Node) && setEmojiOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setEmojiOpen(false)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [emojiOpen])

  if (!me) return null
  const busy = me.status !== 'seated'

  return (
    <nav className="glass pointer-events-auto mx-auto flex items-center gap-1.5 rounded-3xl p-1.5 sm:gap-2 sm:p-2" aria-label="Управление">
      <button
        className={`${base} ${me.micOn ? 'bg-mint text-ink' : off}`}
        onClick={() => setMic(!me.micOn)}
        aria-pressed={me.micOn}
        title={me.micOn ? 'Выключить микрофон' : 'Включить микрофон'}
        aria-label={me.micOn ? 'Выключить микрофон' : 'Включить микрофон'}
      >
        {me.micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
      </button>
      <button
        className={`${base} ${me.camOn ? 'bg-mint text-ink' : off}`}
        onClick={() => setCam(!me.camOn)}
        aria-pressed={me.camOn}
        title={me.camOn ? 'Выключить камеру' : 'Включить камеру'}
        aria-label={me.camOn ? 'Выключить камеру' : 'Включить камеру'}
      >
        {me.camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
      </button>
      <button
        className={`${base} ${me.handRaised ? 'bg-brass text-ink' : off}`}
        onClick={() => toggleHand()}
        disabled={busy}
        aria-pressed={me.handRaised}
        title={me.handRaised ? 'Опустить руку' : 'Поднять руку'}
        aria-label={me.handRaised ? 'Опустить руку' : 'Поднять руку'}
      >
        <Hand className="size-5" />
      </button>
      <div className="relative" ref={pop}>
        <button
          className={`${base} ${emojiOpen ? 'bg-white/20 text-paper' : off}`}
          onClick={() => setEmojiOpen((v) => !v)}
          disabled={busy}
          aria-expanded={emojiOpen}
          title="Реакции"
          aria-label="Реакции"
        >
          <Smile className="size-5" />
        </button>
        {emojiOpen && (
          <div className="glass absolute bottom-full left-1/2 mb-3 flex -translate-x-1/2 gap-1 rounded-2xl p-1.5">
            {REACTIONS.map((e) => (
              <button
                key={e}
                onClick={() => react(e)}
                className="size-10 rounded-xl text-2xl transition hover:scale-115 hover:bg-white/10"
                aria-label={`Реакция ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mx-0.5 h-8 w-px bg-white/10" />
      <button
        className={`${base} ${panel === 'stage' ? 'bg-paper text-ink' : off}`}
        onClick={() => setPanel(panel === 'stage' ? 'none' : 'stage')}
        aria-pressed={panel === 'stage'}
        title="Доска, экран и слайды"
        aria-label="Доска, экран и слайды"
      >
        <Presentation className="size-5" />
        {stageLive && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-mint" aria-label="Идёт показ" />}
      </button>
      <button
        className={`${base} ${panel === 'games' ? 'bg-paper text-ink' : off}`}
        onClick={() => setPanel(panel === 'games' ? 'none' : 'games')}
        aria-pressed={panel === 'games'}
        title="Игры"
        aria-label="Игры"
      >
        <Gamepad2 className="size-5" />
        {gameLive ? (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-mint" aria-label="Идёт игра" />
        ) : proposals > 0 ? (
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-brass text-[11px] font-bold text-ink" aria-label={`Предложений: ${proposals}`}>
            {proposals}
          </span>
        ) : null}
      </button>
      <div className="mx-0.5 h-8 w-px bg-white/10" />
      <button
        className="flex h-10 items-center gap-2 rounded-2xl bg-alarm/90 px-3 font-bold text-ink transition hover:bg-alarm disabled:opacity-40 sm:h-12 sm:px-4"
        aria-label="Покинуть комнату"
        onClick={leaveRoom}
        disabled={me.status === 'leaving'}
      >
        <LogOut className="size-5" />
        <span className="hidden sm:inline">Покинуть</span>
      </button>
    </nav>
  )
}
