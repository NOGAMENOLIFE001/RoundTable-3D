import { create } from 'zustand'
import type { ChatMessage, Participant, Profile, Reaction, StageMode, StageState, Stroke, Toast } from '../types'
import type { JoinResult, ParticipantDTO, ProfileInput, RoomSnapshot } from '../../shared/protocol'
import type { GameId, GameView, Proposal } from '../../shared/games'
import { uid } from '../lib/misc'
import { getLevel, startCamera, startMic, stopMic, stopStream } from '../lib/media'
import { ensureConnected, socket } from '../lib/socket'
import { callPeer, closeAll, closePeer, initRtc, resumeAudio, rtcDebug, setLocalTrack } from '../lib/rtc'
import { applyStroke, clearBoard, removeStroke, setStrokes } from '../lib/board'
import { useApp } from './useAppStore'

/** Длительность анимации «встать и исчезнуть» в Avatar.tsx (с запасом) */
const LEAVE_MS = 1500
const REACTION_MS = 2600

const NO_STAGE: StageState = { mode: 'none', presenterId: null, boardOpen: false, slides: [], slide: 0 }

/**
 * Состояние комнаты. Источник правды — сервер (server/index.ts):
 * действия отправляют события, изменения приходят обратно через обработчики ниже.
 * Локально ведём только анимационный статус участника и открытые панели.
 */
interface RoomState {
  code: string | null
  topic: string
  selfId: string | null
  participants: Participant[]
  messages: ChatMessage[]
  reactions: Reaction[]
  toasts: Toast[]
  camStream: MediaStream | null
  /** Своя демонстрация экрана */
  screenStream: MediaStream | null
  /** Входящие потоки WebRTC по id участника */
  remoteStreams: Record<string, MediaStream>
  remoteScreens: Record<string, MediaStream>
  stage: StageState
  proposals: Proposal[]
  game: GameView | null
  /** Какая панель развёрнута поверх 3D */
  panel: 'none' | 'stage' | 'games'

  createRoom: (profile: Profile, topic: string) => Promise<string | null>
  joinRoom: (profile: Profile, code: string) => Promise<string | null>
  leaveRoom: () => void
  setTopic: (topic: string) => void
  updateProfile: (p: ProfileInput) => void
  sendMessage: (text: string) => void
  toggleHand: () => void
  react: (emoji: string) => void
  setMic: (on: boolean) => Promise<void>
  setCam: (on: boolean) => Promise<void>
  markSeated: (id: string) => void
  dismissToast: (id: string) => void
  setPanel: (p: RoomState['panel']) => void

  setStageMode: (mode: StageMode) => void
  setBoardAccess: (open: boolean) => void
  sendStroke: (s: Stroke) => void
  undoStroke: () => void
  clearStrokes: () => void
  setSlides: (slides: string[]) => Promise<boolean>
  gotoSlide: (i: number) => void
  startScreenShare: () => Promise<void>
  stopScreenShare: () => void

  proposeGame: (id: GameId) => void
  startGame: (id: GameId) => void
  stopGame: () => void
  gameAction: (a: Record<string, unknown>) => void
}

const emptyRoom = {
  code: null,
  topic: '',
  selfId: null,
  participants: [] as Participant[],
  messages: [] as ChatMessage[],
  reactions: [] as Reaction[],
  toasts: [] as Toast[],
  camStream: null,
  screenStream: null,
  remoteStreams: {} as Record<string, MediaStream>,
  remoteScreens: {} as Record<string, MediaStream>,
  stage: NO_STAGE,
  proposals: [] as Proposal[],
  game: null,
  panel: 'none' as const,
}

const JOIN_ERRORS: Record<string, string> = {
  not_found: 'Комнаты с таким кодом нет. Проверьте код или создайте новую комнату.',
  full: 'За столом заняты все 8 мест.',
  bad_request: 'Сервер не принял данные профиля. Откройте редактор персонажа и проверьте имя.',
}
const OFFLINE = 'Сервер недоступен. Запустите его командой npm run dev и попробуйте снова.'
const UNAUTHORIZED = 'Сервер не принял вход. Выйдите из профиля и войдите снова.'

const timers = new Set<ReturnType<typeof setTimeout>>()
function later(fn: () => void, ms: number) {
  const t = setTimeout(() => {
    timers.delete(t)
    fn()
  }, ms)
  timers.add(t)
}

function setUrlCode(code: string | null) {
  const url = new URL(location.href)
  if (code) url.searchParams.set('room', code)
  else url.searchParams.delete('room')
  history.replaceState(null, '', url)
}

const toInput = ({ id: _id, ...rest }: Profile): ProfileInput => rest

export const useRoom = create<RoomState>((set, get) => {
  const self = () => get().participants.find((p) => p.id === get().selfId)
  const byId = (id: string) => get().participants.find((p) => p.id === id)
  const patch = (id: string, data: Partial<Participant>) =>
    set((s) => ({ participants: s.participants.map((p) => (p.id === id ? { ...p, ...data } : p)) }))

  const toast = (text: string) => {
    const t = { id: uid(), text }
    set((s) => ({ toasts: [...s.toasts, t].slice(-4) }))
    later(() => get().dismissToast(t.id), 3800)
  }

  const stopScreen = () => {
    const s = get().screenStream
    if (!s) return
    stopStream(s)
    void setLocalTrack('screen', null)
    set({ screenStream: null })
  }

  /** Выйти из комнаты локально: остановить медиа, закрыть сокет, вернуться в лобби */
  let leaving = false
  const reset = (notice?: string) => {
    stopMic()
    stopStream(get().camStream)
    stopScreen()
    closeAll()
    timers.forEach(clearTimeout)
    timers.clear()
    leaving = true
    socket.disconnect()
    leaving = false
    set(emptyRoom)
    clearBoard()
    setUrlCode(null)
    useApp.getState().setScreen('lobby')
    if (notice) useApp.getState().setNotice(notice)
  }

  // ---------- события сервера ----------

  socket.on('participant:joined', (p: ParticipantDTO) => {
    if (byId(p.id)) return
    set((s) => ({ participants: [...s.participants, { ...p, status: 'entering' }] }))
  })

  socket.on('participant:updated', (id, data) => {
    const before = byId(id)
    if (!before) return
    patch(id, data)
    if (data.handRaised && !before.handRaised) toast(`${id === get().selfId ? 'Вы подняли' : `${before.name} поднимает`} руку`)
    if (data.isHost && !before.isHost && id === get().selfId) toast('Теперь вы главный: управляете темой, доской и играми')
  })

  socket.on('participant:left', (id) => {
    if (id === get().selfId) return
    closePeer(id)
    patch(id, { status: 'leaving', handRaised: false })
    later(() => set((s) => ({ participants: s.participants.filter((p) => p.id !== id) })), LEAVE_MS)
  })

  socket.on('chat:message', (m) => {
    if (get().messages.some((x) => x.id === m.id)) return
    set((s) => ({ messages: [...s.messages, m].slice(-200) }))
  })

  socket.on('room:topic', (topic) => set({ topic }))

  socket.on('reaction', (r) => {
    set((s) => ({ reactions: [...s.reactions, { ...r, ts: Date.now() }] }))
    later(() => set((s) => ({ reactions: s.reactions.filter((x) => x.id !== r.id) })), REACTION_MS)
  })

  socket.on('notice', toast)

  socket.on('stage', (stage) => {
    const prev = get().stage
    set({ stage })
    // Главный что-то показывает — разворачиваем у всех
    if (stage.mode !== 'none' && stage.mode !== prev.mode && get().panel !== 'games') set({ panel: 'stage' })
    if (stage.mode === 'none' && get().panel === 'stage') set({ panel: 'none' })
    if (stage.mode !== 'screen' || stage.presenterId !== get().selfId) stopScreen()
  })
  socket.on('board:stroke', applyStroke)
  socket.on('board:remove', removeStroke)
  socket.on('board:clear', clearBoard)

  socket.on('game:proposals', (proposals) => set({ proposals }))
  socket.on('game:view', (game) => {
    const prev = get().game
    set({ game })
    if (game && !prev) set({ panel: 'games' })
    if (!game && get().panel === 'games') set({ panel: 'none' })
  })

  socket.on('disconnect', () => {
    if (!leaving && get().code) reset('Связь с сервером прервалась. Войдите в комнату снова по коду.')
  })

  // ---------- WebRTC ----------

  const setMap = (key: 'remoteStreams' | 'remoteScreens', id: string, stream: MediaStream | null) =>
    set((s) => {
      const next = { ...s[key] }
      if (stream) next[id] = stream
      else delete next[id]
      return { [key]: next } as Partial<RoomState>
    })

  let audioHintShown = false
  initRtc({
    onRemoteStream: (id, stream) => setMap('remoteStreams', id, stream),
    onRemoteScreen: (id, stream) => setMap('remoteScreens', id, stream),
    onConnectionState: (id, state) => {
      if (state === 'failed') toast(`Нет прямой связи с ${byId(id)?.name ?? 'участником'}. В этой сети нужен TURN-сервер.`)
    },
    onAutoplayBlocked: () => {
      if (audioHintShown) return
      audioHintShown = true
      toast('Браузер заблокировал звук. Нажмите в любом месте страницы.')
      window.addEventListener('pointerdown', () => resumeAudio(), { once: true })
    },
  })

  // ---------- вход ----------

  const enter = (room: RoomSnapshot, selfId: string) => {
    set({
      ...emptyRoom,
      code: room.code,
      topic: room.topic,
      selfId,
      participants: room.participants.map((p) => ({ ...p, status: p.id === selfId ? 'entering' : 'seated' })),
      messages: room.messages,
      stage: room.stage,
      proposals: room.proposals,
      game: room.game,
    })
    setStrokes(room.strokes)
    setUrlCode(room.code)
    useApp.getState().setScreen('room')
    // Новичок сам звонит всем, кто уже за столом
    room.participants.filter((p) => p.id !== selfId && !p.isBot).forEach((p) => callPeer(p.id))
  }

  const connectAnd = async (send: () => Promise<JoinResult>): Promise<string | null> => {
    try {
      await ensureConnected()
    } catch (e) {
      return (e as Error).message === 'unauthorized' ? UNAUTHORIZED : OFFLINE
    }
    try {
      const res = await send()
      if (!res.ok) return JOIN_ERRORS[res.error] ?? 'Не удалось войти в комнату.'
      enter(res.room, res.selfId)
      return null
    } catch {
      return 'Сервер не ответил вовремя. Попробуйте ещё раз.'
    }
  }

  return {
    ...emptyRoom,

    createRoom: (profile, topic) =>
      connectAnd(() => socket.timeout(5000).emitWithAck('room:create', { profile: toInput(profile), topic })),

    joinRoom: (profile, code) =>
      connectAnd(() => socket.timeout(5000).emitWithAck('room:join', { profile: toInput(profile), code })),

    leaveRoom: () => {
      const me = self()
      if (!me || me.status === 'leaving') return
      socket.emit('room:leave')
      stopMic()
      stopStream(get().camStream)
      stopScreen()
      closeAll()
      set({ camStream: null, panel: 'none' })
      patch(me.id, { status: 'leaving', micOn: false, camOn: false, handRaised: false })
      later(() => reset(), LEAVE_MS)
    },

    setTopic: (topic) => {
      if (self()?.isHost && topic.trim()) socket.emit('room:topic', topic)
    },
    updateProfile: (p) => {
      if (get().code) socket.emit('profile:update', p)
    },
    sendMessage: (text) => {
      if (text.trim()) socket.emit('chat:send', text)
    },
    toggleHand: () => void socket.emit('hand:toggle'),
    react: (emoji) => void socket.emit('reaction', emoji),

    setMic: async (on) => {
      const me = self()
      if (!me) return
      if (on) {
        try {
          await setLocalTrack('audio', await startMic(me.id))
        } catch {
          return toast('Нет доступа к микрофону. Разрешите его в настройках сайта в браузере.')
        }
      } else {
        stopMic()
        await setLocalTrack('audio', null)
      }
      socket.emit('media:update', { micOn: on })
    },

    setCam: async (on) => {
      const me = self()
      if (!me) return
      if (on) {
        try {
          const stream = await startCamera()
          set({ camStream: stream })
          await setLocalTrack('video', stream.getVideoTracks()[0] ?? null)
        } catch {
          return toast('Нет доступа к камере. Разрешите её в настройках сайта в браузере.')
        }
      } else {
        await setLocalTrack('video', null)
        stopStream(get().camStream)
        set({ camStream: null })
      }
      socket.emit('media:update', { camOn: on })
    },

    markSeated: (id) => {
      if (byId(id)?.status === 'entering') patch(id, { status: 'seated' })
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    setPanel: (panel) => set({ panel }),

    // ---------- сцена ----------

    setStageMode: (mode) => socket.emit('stage:mode', mode),
    setBoardAccess: (open) => socket.emit('board:access', open),
    // Локально штрих рисует сама доска (StageOverlay), сюда приходят пачки точек для сервера
    sendStroke: (s) => void socket.emit('board:stroke', s),
    undoStroke: () => socket.emit('board:undo'),
    clearStrokes: () => socket.emit('board:clear'),
    setSlides: async (slides) => {
      try {
        return await socket.timeout(30000).emitWithAck('slides:set', slides)
      } catch {
        toast('Слайды не загрузились: файл слишком большой или сервер не ответил')
        return false
      }
    },
    gotoSlide: (i) => socket.emit('slides:goto', i),

    startScreenShare: async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false })
        const track = stream.getVideoTracks()[0]
        // Пользователь нажал «Прекратить показ» в браузере
        track.addEventListener('ended', () => get().stopScreenShare())
        set({ screenStream: stream })
        await setLocalTrack('screen', track)
        socket.emit('stage:mode', 'screen')
      } catch {
        toast('Демонстрация экрана отменена или недоступна в этом браузере')
      }
    },
    stopScreenShare: () => {
      stopScreen()
      if (get().stage.mode === 'screen') socket.emit('stage:mode', 'none')
    },

    // ---------- игры ----------

    proposeGame: (id) => socket.emit('game:propose', id),
    startGame: (id) => socket.emit('game:start', id),
    stopGame: () => socket.emit('game:stop'),
    gameAction: (a) => socket.emit('game:action', a),
  }
})

// Отладка из консоли браузера в dev-режиме: __room.getState()
if (import.meta.env.DEV) Object.assign(window, { __room: useRoom, __rtc: rtcDebug, __level: getLevel })
