import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Eraser, Lock, LockOpen, MonitorUp, MonitorX, PenLine, Trash2, Undo2, Upload, X,
} from 'lucide-react'
import type { StageMode } from '../types'
import { useRoom } from '../store/useRoomStore'
import { BOARD_H, BOARD_W, applyStroke, boardCanvas, onBoardChange } from '../lib/board'
import { filesToSlides } from '../lib/slides'
import { uid } from '../lib/misc'

const PEN_COLORS = ['#F3F6FB', '#5EF2C7', '#E0B15C', '#FF8FAB', '#7AA7FF', '#FF6B6B']
const WIDTHS = [3, 6, 12]

const tool = 'flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition disabled:opacity-40'
const toolOff = 'bg-white/8 text-paper hover:bg-white/15'

// ---------- доска ----------

function Board({ canDraw, isHost }: { canDraw: boolean; isHost: boolean }) {
  const { sendStroke, undoStroke, clearStrokes, setBoardAccess } = useRoom.getState()
  const selfId = useRoom((s) => s.selfId)!
  const boardOpen = useRoom((s) => s.stage.boardOpen)
  const ref = useRef<HTMLCanvasElement>(null)
  const [color, setColor] = useState(PEN_COLORS[1])
  const [width, setWidth] = useState(WIDTHS[1])
  const [erase, setErase] = useState(false)
  const drawing = useRef<{ id: string; buffer: number[]; timer: ReturnType<typeof setInterval> } | null>(null)

  // Видимый холст повторяет общий холст доски
  useEffect(() => {
    const paint = () => ref.current?.getContext('2d')?.drawImage(boardCanvas(), 0, 0)
    paint()
    return onBoardChange(paint)
  }, [])

  const point = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]
  }
  const meta = () => ({ by: selfId, color, width, erase })

  const flush = () => {
    const d = drawing.current
    if (!d || !d.buffer.length) return
    sendStroke({ id: d.id, ...meta(), points: d.buffer })
    d.buffer = []
  }

  const down = (e: React.PointerEvent) => {
    if (!canDraw) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = point(e)
    const id = uid()
    // Точки уходят на сервер пачками раз в 40 мс, локально рисуем сразу
    drawing.current = { id, buffer: [...p], timer: setInterval(flush, 40) }
    applyStroke({ id, ...meta(), points: p })
  }
  const move = (e: React.PointerEvent) => {
    const d = drawing.current
    if (!d) return
    const p = point(e)
    d.buffer.push(...p)
    applyStroke({ id: d.id, ...meta(), points: p })
  }
  const up = () => {
    const d = drawing.current
    if (!d) return
    clearInterval(d.timer)
    flush()
    drawing.current = null
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {canDraw && (
        <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Инструменты доски">
          <button className={`${tool} ${!erase ? 'bg-paper text-ink' : toolOff}`} onClick={() => setErase(false)} aria-pressed={!erase}>
            <PenLine className="size-4" /> Перо
          </button>
          <button className={`${tool} ${erase ? 'bg-paper text-ink' : toolOff}`} onClick={() => setErase(true)} aria-pressed={erase}>
            <Eraser className="size-4" /> Ластик
          </button>
          <span className="mx-1 h-6 w-px bg-white/10" />
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c)
                setErase(false)
              }}
              className={`size-8 rounded-full ${c === color && !erase ? 'ring-2 ring-paper ring-offset-2 ring-offset-ink-2' : ''}`}
              style={{ background: c }}
              aria-label={`Цвет ${c}`}
              aria-pressed={c === color && !erase}
            />
          ))}
          <span className="mx-1 h-6 w-px bg-white/10" />
          {WIDTHS.map((w) => (
            <button key={w} onClick={() => setWidth(w)} className={`${tool} ${w === width ? 'bg-white/20' : toolOff}`} aria-label={`Толщина ${w}`} aria-pressed={w === width}>
              <span className="rounded-full bg-paper" style={{ width: w + 4, height: w + 4 }} />
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-white/10" />
          <button className={`${tool} ${toolOff}`} onClick={undoStroke}>
            <Undo2 className="size-4" /> Отменить
          </button>
          {isHost && (
            <>
              <button className={`${tool} ${toolOff}`} onClick={clearStrokes}>
                <Trash2 className="size-4" /> Очистить
              </button>
              <button className={`${tool} ${boardOpen ? 'bg-mint text-ink' : toolOff}`} onClick={() => setBoardAccess(!boardOpen)} aria-pressed={boardOpen}>
                {boardOpen ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
                {boardOpen ? 'Рисуют все' : 'Рисует только главный'}
              </button>
            </>
          )}
        </div>
      )}
      {!canDraw && <p className="text-xs text-fog">Рисует главный. Он может разрешить рисовать всем.</p>}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <canvas
          ref={ref}
          width={BOARD_W}
          height={BOARD_H}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className={`aspect-video max-h-full w-full max-w-full touch-none rounded-2xl ring-1 ring-white/10 ${canDraw ? (erase ? 'cursor-cell' : 'cursor-crosshair') : ''}`}
          style={{ objectFit: 'contain' }}
          aria-label="Общая доска"
        />
      </div>
    </div>
  )
}

// ---------- слайды ----------

function Slides({ isHost }: { isHost: boolean }) {
  const { slides, slide } = useRoom((s) => s.stage)
  const { gotoSlide, setSlides } = useRoom.getState()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isHost) return
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'ArrowRight') gotoSlide(slide + 1)
      if (e.key === 'ArrowLeft') gotoSlide(slide - 1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [isHost, slide, gotoSlide])

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setError('')
    try {
      const list = await filesToSlides([...files])
      if (!list.length) setError('Подходят картинки (PNG, JPG) и PDF')
      else await setSlides(list)
    } catch {
      setError('Не удалось прочитать файл. Попробуйте другой PDF или картинки.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {isHost && (
        <div className="flex flex-wrap items-center gap-1.5">
          <input ref={input} type="file" accept="image/*,.pdf,application/pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
          <button className={`${tool} bg-mint text-ink`} onClick={() => input.current?.click()} disabled={busy}>
            <Upload className="size-4" /> {busy ? 'Готовим слайды…' : slides.length ? 'Загрузить другие' : 'Загрузить PDF или картинки'}
          </button>
          {error && <span className="text-xs text-alarm">{error}</span>}
        </div>
      )}
      <div className="relative flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-ink-2/60">
        {slides[slide] ? (
          <img src={slides[slide]} alt={`Слайд ${slide + 1}`} className="max-h-full max-w-full rounded-xl object-contain" />
        ) : (
          <p className="px-6 text-center text-sm text-fog">{isHost ? 'Загрузите PDF или картинки: слайды увидят все за столом.' : 'Главный ещё не загрузил слайды.'}</p>
        )}
      </div>
      {slides.length > 0 && (
        <div className="flex items-center justify-center gap-3">
          {isHost && (
            <button className={`${tool} ${toolOff}`} onClick={() => gotoSlide(slide - 1)} disabled={slide === 0} aria-label="Предыдущий слайд">
              <ChevronLeft className="size-4" />
            </button>
          )}
          <span className="text-sm tabular-nums text-fog">{slide + 1} / {slides.length}</span>
          {isHost && (
            <button className={`${tool} ${toolOff}`} onClick={() => gotoSlide(slide + 1)} disabled={slide >= slides.length - 1} aria-label="Следующий слайд">
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- демонстрация экрана ----------

function Screen({ isHost }: { isHost: boolean }) {
  const stage = useRoom((s) => s.stage)
  const selfId = useRoom((s) => s.selfId)
  const own = useRoom((s) => s.screenStream)
  const remote = useRoom((s) => (s.stage.presenterId ? s.remoteScreens[s.stage.presenterId] : undefined))
  const presenter = useRoom((s) => s.participants.find((p) => p.id === s.stage.presenterId))
  const { startScreenShare, stopScreenShare } = useRoom.getState()
  const video = useRef<HTMLVideoElement>(null)
  const sharing = stage.mode === 'screen' && stage.presenterId === selfId
  const stream = sharing ? own : stage.mode === 'screen' ? remote ?? null : null

  useEffect(() => {
    if (video.current) video.current.srcObject = stream
  }, [stream])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {isHost && (
        <div className="flex items-center gap-1.5">
          {sharing ? (
            <button className={`${tool} bg-alarm text-ink`} onClick={stopScreenShare}>
              <MonitorX className="size-4" /> Остановить показ
            </button>
          ) : (
            <button className={`${tool} bg-mint text-ink`} onClick={() => void startScreenShare()}>
              <MonitorUp className="size-4" /> Показать свой экран
            </button>
          )}
        </div>
      )}
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-ink-2/60">
        {stream ? (
          <video ref={video} autoPlay muted playsInline className="max-h-full max-w-full rounded-xl" aria-label={`Экран: ${presenter?.name ?? ''}`} />
        ) : (
          <p className="px-6 text-center text-sm text-fog">
            {isHost ? 'Нажмите «Показать свой экран» и выберите окно или весь экран.' : stage.mode === 'screen' ? 'Подключаем экран…' : 'Главный сейчас не показывает экран.'}
          </p>
        )}
      </div>
    </div>
  )
}

// ---------- панель ----------

const MODES: { id: StageMode; label: string }[] = [
  { id: 'board', label: 'Доска' },
  { id: 'slides', label: 'Слайды' },
  { id: 'screen', label: 'Экран' },
]

export function StageOverlay() {
  const stage = useRoom((s) => s.stage)
  const isHost = useRoom((s) => s.participants.find((p) => p.id === s.selfId)?.isHost ?? false)
  const { setStageMode, setPanel, stopScreenShare } = useRoom.getState()
  // Главный может заранее открыть вкладку (например, слайды до загрузки) — не меняя то, что видят все
  const [view, setView] = useState<StageMode>(stage.mode === 'none' ? 'board' : stage.mode)
  useEffect(() => {
    if (stage.mode !== 'none') setView(stage.mode)
  }, [stage.mode])
  // Главный открыл панель, а показа нет — включаем доску у всех
  useEffect(() => {
    if (isHost && useRoom.getState().stage.mode === 'none') setStageMode('board')
  }, [isHost, setStageMode])

  const shown = isHost ? view : stage.mode
  const canDraw = isHost || stage.boardOpen

  const pick = (m: StageMode) => {
    setView(m)
    if (m === 'board') setStageMode('board')
    if (m === 'slides' && stage.slides.length) setStageMode('slides')
    // Экран включается кнопкой «Показать свой экран» — нужен выбор окна
  }

  return (
    <section className="glass pointer-events-auto flex h-full min-h-0 w-full flex-col gap-3 rounded-3xl p-3 sm:p-4" aria-label="Доска и показ">
      <header className="flex flex-wrap items-center gap-2">
        {isHost ? (
          <div className="flex gap-1 rounded-xl bg-ink/60 p-1" role="tablist" aria-label="Что показать всем">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="tab"
                aria-selected={view === m.id}
                onClick={() => pick(m.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${view === m.id ? 'bg-paper text-ink' : 'text-fog hover:text-paper'}`}
              >
                {m.label}
                {stage.mode === m.id && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-mint align-middle" aria-label="показывается" />}
              </button>
            ))}
          </div>
        ) : (
          <h2 className="font-display text-base font-bold">{MODES.find((m) => m.id === stage.mode)?.label ?? 'Показ'}</h2>
        )}
        <div className="flex-1" />
        {isHost && stage.mode !== 'none' && (
          <button
            className={`${tool} ${toolOff}`}
            onClick={() => {
              if (stage.mode === 'screen') stopScreenShare()
              else setStageMode('none')
            }}
          >
            Скрыть у всех
          </button>
        )}
        <button onClick={() => setPanel('none')} className="rounded-lg p-2 text-fog hover:bg-white/10 hover:text-paper" aria-label="Свернуть панель">
          <X className="size-5" />
        </button>
      </header>

      {shown === 'board' && <Board canDraw={canDraw} isHost={isHost} />}
      {shown === 'slides' && <Slides isHost={isHost} />}
      {shown === 'screen' && <Screen isHost={isHost} />}
      {shown === 'none' && (
        <p className="flex flex-1 items-center justify-center text-center text-sm text-fog">
          Главный пока ничего не показывает. Когда он откроет доску, слайды или экран, они появятся здесь и на большом экране в зале.
        </p>
      )}
    </section>
  )
}
