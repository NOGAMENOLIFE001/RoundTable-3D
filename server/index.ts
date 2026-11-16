import { createServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import type { ChatMessage, StageState, Stroke } from '../shared/types'
import { GAMES, gameInfo, type GameId, type Proposal } from '../shared/games'
import {
  APPEARANCE_OPTIONS, DEFAULT_APPEARANCE, MAX_MESSAGE, MAX_NAME, MAX_SLIDES, MAX_SOCKET_BYTES, MAX_TOPIC,
  REACTIONS, SEAT_COUNT, SEAT_RELEASE_MS,
  type ClientToServerEvents, type JoinResult, type ParticipantDTO, type ProfileInput,
  type RoomSnapshot, type ServerToClientEvents,
} from '../shared/protocol'
import { generateRoomCode, isValidCode, uid } from '../src/lib/misc'
import { authRequired, verifyToken } from './auth'
import type { Engine } from './games/engine'
import { durak } from './games/durak'
import { pikdama } from './games/pikdama'
import { mafia } from './games/mafia'
import { bunker } from './games/bunker'

const PORT = Number(process.env.PORT ?? 3001)
/** Пустая комната живёт ещё немного — чтобы пережить перезагрузку страницы */
const EMPTY_ROOM_TTL_MS = 60_000
const MAX_HISTORY = 200
const MAX_STROKES = 3000
const MAX_STROKE_POINTS = 4000

const ENGINES: Record<GameId, Engine<any>> = { durak, pikdama, mafia, bunker }

interface Game {
  id: GameId
  engine: Engine<any>
  state: unknown
}

interface Room {
  code: string
  topic: string
  participants: Map<string, ParticipantDTO>
  /** Стулья, которые освобождаются после анимации ухода */
  releasing: Set<number>
  messages: ChatMessage[]
  stage: StageState
  strokes: Stroke[]
  proposals: Map<GameId, Set<string>>
  game: Game | null
  emptyTimer?: ReturnType<typeof setTimeout>
}

interface SocketData {
  code?: string
  uid: string | null
  lastChat: number[]
  lastReaction: number
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>
type Sock = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>

const rooms = new Map<string, Room>()

const http = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, authRequired }))
    return
  }
  res.writeHead(404)
  res.end()
})

const io: IO = new Server(http, {
  // В dev клиент ходит через прокси Vite (тот же origin); CORS — для прямого подключения
  cors: { origin: process.env.CLIENT_ORIGIN?.split(',') ?? true },
  maxHttpBufferSize: MAX_SOCKET_BYTES,
})

// Firebase: без валидного ID-токена в комнаты не пускаем (если проект настроен)
io.use(async (socket, next) => {
  try {
    socket.data.uid = await verifyToken(socket.handshake.auth?.token)
    next()
  } catch {
    next(new Error('unauthorized'))
  }
})

// ---------- helpers ----------

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const isHex = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback)

function parseProfile(p: unknown): ProfileInput | null {
  if (!p || typeof p !== 'object') return null
  const r = p as Record<string, unknown>
  const name = clean(r.name, MAX_NAME)
  if (name.length < 2) return null
  const d = DEFAULT_APPEARANCE
  return {
    name,
    color: isHex(r.color) ? r.color : d.color,
    skin: isHex(r.skin) ? r.skin : d.skin,
    hairColor: isHex(r.hairColor) ? r.hairColor : d.hairColor,
    style: oneOf(r.style, APPEARANCE_OPTIONS.style, d.style),
    hair: oneOf(r.hair, APPEARANCE_OPTIONS.hair, d.hair),
    outfit: oneOf(r.outfit, APPEARANCE_OPTIONS.outfit, d.outfit),
    accessory: oneOf(r.accessory, APPEARANCE_OPTIONS.accessory, d.accessory),
  }
}

function freeSeat(room: Room) {
  const taken = new Set([...room.participants.values()].map((p) => p.seat))
  for (let i = 0; i < SEAT_COUNT; i++) if (!taken.has(i) && !room.releasing.has(i)) return i
  return -1
}

const people = (room: Room) => [...room.participants.values()]

const proposalsList = (room: Room): Proposal[] =>
  [...room.proposals].filter(([, by]) => by.size).map(([gameId, by]) => ({ gameId, by: [...by] }))

const snapshot = (room: Room, viewer: string): RoomSnapshot => ({
  code: room.code,
  topic: room.topic,
  participants: people(room).map((p) => ({ ...p })),
  messages: room.messages.slice(),
  stage: { ...room.stage },
  strokes: room.strokes,
  proposals: proposalsList(room),
  game: room.game ? room.game.engine.view(room.game.state, viewer) : null,
})

function pushMessage(room: Room, m: Omit<ChatMessage, 'id' | 'ts'>) {
  const msg: ChatMessage = { ...m, id: uid(), ts: Date.now() }
  room.messages.push(msg)
  if (room.messages.length > MAX_HISTORY) room.messages.splice(0, room.messages.length - MAX_HISTORY)
  io.to(room.code).emit('chat:message', msg)
}

const system = (room: Room, text: string) => pushMessage(room, { authorId: null, authorName: '', color: '', text, system: true })

function update(room: Room, id: string, patch: Partial<ParticipantDTO>) {
  const p = room.participants.get(id)
  if (!p) return
  Object.assign(p, patch)
  io.to(room.code).emit('participant:updated', id, patch)
}

const emitStage = (room: Room) => io.to(room.code).emit('stage', room.stage)
const emitProposals = (room: Room) => io.to(room.code).emit('game:proposals', proposalsList(room))

/** Каждому — своя версия игры (свои карты и роль) */
function emitGame(room: Room) {
  for (const id of room.participants.keys()) {
    io.to(id).emit('game:view', room.game ? room.game.engine.view(room.game.state, id) : null)
  }
}

function removeParticipant(room: Room, id: string) {
  const p = room.participants.get(id)
  if (!p) return
  room.participants.delete(id)
  room.releasing.add(p.seat)
  setTimeout(() => room.releasing.delete(p.seat), SEAT_RELEASE_MS)
  io.to(room.code).emit('participant:left', id)
  system(room, `${p.name} покидает комнату`)

  for (const set of room.proposals.values()) set.delete(id)
  emitProposals(room)
  if (room.game) {
    room.game.engine.leave(room.game.state, id)
    emitGame(room)
  }
  if (room.stage.presenterId === id) {
    room.stage = { ...room.stage, mode: 'none', presenterId: null }
    emitStage(room)
  }

  // Главный ушёл — роль переходит к тому, кто сидит дольше всех
  if (p.isHost) {
    const next = people(room)[0]
    if (next) {
      update(room, next.id, { isHost: true })
      system(room, `Теперь главный — ${next.name}`)
    }
  }

  if (room.participants.size === 0) {
    room.emptyTimer = setTimeout(() => rooms.delete(room.code), EMPTY_ROOM_TTL_MS)
  }
}

function enter(socket: Sock, room: Room, profile: ProfileInput, isHost: boolean): JoinResult {
  const seat = freeSeat(room)
  if (seat < 0) return { ok: false, error: 'full' }
  const p: ParticipantDTO = {
    ...profile, id: socket.id, seat, isBot: false, isHost, micOn: false, camOn: false, handRaised: false,
  }
  room.participants.set(p.id, p)
  if (room.emptyTimer) clearTimeout(room.emptyTimer)
  room.emptyTimer = undefined
  // Сначала рассылаем остальным, потом добавляем сокет в комнату
  io.to(room.code).emit('participant:joined', p)
  socket.join(room.code)
  socket.data.code = room.code
  const snap = snapshot(room, p.id)
  system(room, `${p.name} входит в комнату`)
  return { ok: true, selfId: p.id, room: snap }
}

function leave(socket: Sock) {
  const room = socket.data.code ? rooms.get(socket.data.code) : undefined
  socket.data.code = undefined
  if (!room) return
  socket.leave(room.code)
  removeParticipant(room, socket.id)
}

function parseStroke(raw: unknown, by: string): Stroke | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || r.id.length > 40 || !Array.isArray(r.points)) return null
  const points = r.points.slice(0, MAX_STROKE_POINTS).map(Number)
  if (points.some((v) => !Number.isFinite(v) || v < -0.1 || v > 1.1)) return null
  return {
    id: r.id, by, points,
    color: isHex(r.color) ? r.color : '#F3F6FB',
    width: Math.min(40, Math.max(1, Number(r.width) || 4)),
    erase: r.erase === true,
  }
}

// ---------- connection ----------

io.on('connection', (socket) => {
  socket.data.lastChat = []
  socket.data.lastReaction = 0

  /** Комната сокета и сам участник — для всех событий внутри комнаты */
  const ctx = () => {
    const room = socket.data.code ? rooms.get(socket.data.code) : undefined
    const me = room?.participants.get(socket.id)
    return room && me ? { room, me } : null
  }
  const hostCtx = () => {
    const c = ctx()
    if (c && !c.me.isHost) socket.emit('notice', 'Это может сделать только главный')
    return c?.me.isHost ? c : null
  }

  socket.on('room:create', (data, ack) => {
    if (typeof ack !== 'function') return
    const profile = parseProfile(data?.profile)
    if (!profile) return ack({ ok: false, error: 'bad_request' })
    leave(socket)
    let code = generateRoomCode()
    while (rooms.has(code)) code = generateRoomCode()
    const room: Room = {
      code, topic: clean(data.topic, MAX_TOPIC) || 'Без темы',
      participants: new Map(), releasing: new Set(), messages: [],
      stage: { mode: 'none', presenterId: null, boardOpen: false, slides: [], slide: 0 },
      strokes: [], proposals: new Map(), game: null,
    }
    rooms.set(code, room)
    ack(enter(socket, room, profile, true))
  })

  socket.on('room:join', (data, ack) => {
    if (typeof ack !== 'function') return
    const profile = parseProfile(data?.profile)
    const code = clean(data?.code, 6).toUpperCase()
    if (!profile || !isValidCode(code)) return ack({ ok: false, error: 'bad_request' })
    const room = rooms.get(code)
    if (!room) return ack({ ok: false, error: 'not_found' })
    leave(socket)
    // Если в комнате никого нет (комната ещё жива) — вошедший становится главным
    ack(enter(socket, room, profile, room.participants.size === 0))
  })

  socket.on('room:leave', () => leave(socket))

  socket.on('room:topic', (topic) => {
    const c = hostCtx()
    const t = clean(topic, MAX_TOPIC)
    if (!c || !t || t === c.room.topic) return
    c.room.topic = t
    io.to(c.room.code).emit('room:topic', t)
    system(c.room, `Новая тема: «${t}»`)
  })

  socket.on('profile:update', (raw) => {
    const c = ctx()
    const p = parseProfile(raw)
    if (!c || !p) return
    update(c.room, c.me.id, p)
  })

  socket.on('chat:send', (text) => {
    const c = ctx()
    const t = clean(text, MAX_MESSAGE)
    if (!c || !t) return
    const now = Date.now()
    socket.data.lastChat = socket.data.lastChat.filter((x) => now - x < 5000)
    if (socket.data.lastChat.length >= 5) return void socket.emit('notice', 'Слишком часто. Подождите пару секунд.')
    socket.data.lastChat.push(now)
    pushMessage(c.room, { authorId: c.me.id, authorName: c.me.name, color: c.me.color, text: t })
  })

  socket.on('hand:toggle', () => {
    const c = ctx()
    if (c) update(c.room, c.me.id, { handRaised: !c.me.handRaised })
  })

  socket.on('media:update', (state) => {
    const c = ctx()
    if (!c || !state || typeof state !== 'object') return
    const patch: Partial<ParticipantDTO> = {}
    if (typeof state.micOn === 'boolean') patch.micOn = state.micOn
    if (typeof state.camOn === 'boolean') patch.camOn = state.camOn
    if (Object.keys(patch).length) update(c.room, c.me.id, patch)
  })

  socket.on('reaction', (emoji) => {
    const c = ctx()
    const now = Date.now()
    if (!c || !REACTIONS.includes(emoji) || now - socket.data.lastReaction < 300) return
    socket.data.lastReaction = now
    io.to(c.room.code).emit('reaction', { id: uid(), participantId: c.me.id, emoji, ts: now })
  })

  // Сигналинг WebRTC: сервер только пересылает, медиа идёт напрямую между браузерами
  socket.on('rtc:signal', (to, data) => {
    const c = ctx()
    if (!c || typeof to !== 'string' || !c.room.participants.has(to) || to === socket.id) return
    if (!data || typeof data !== 'object' || JSON.stringify(data).length > 64_000) return
    io.to(to).emit('rtc:signal', socket.id, data)
  })

  // ---------- сцена ----------

  socket.on('stage:mode', (mode) => {
    const c = hostCtx()
    if (!c || !['none', 'board', 'screen', 'slides'].includes(mode)) return
    if (mode === 'slides' && !c.room.stage.slides.length) return void socket.emit('notice', 'Сначала загрузите слайды')
    c.room.stage = { ...c.room.stage, mode, presenterId: mode === 'screen' ? c.me.id : null }
    emitStage(c.room)
  })

  socket.on('board:access', (open) => {
    const c = hostCtx()
    if (!c) return
    c.room.stage = { ...c.room.stage, boardOpen: !!open }
    emitStage(c.room)
  })

  socket.on('board:stroke', (raw) => {
    const c = ctx()
    if (!c || (!c.me.isHost && !c.room.stage.boardOpen)) return
    const s = parseStroke(raw, c.me.id)
    if (!s) return
    const existing = c.room.strokes.find((x) => x.id === s.id)
    if (existing) {
      if (existing.by !== c.me.id) return
      existing.points.push(...s.points.slice(0, MAX_STROKE_POINTS - existing.points.length))
    } else {
      c.room.strokes.push(s)
      if (c.room.strokes.length > MAX_STROKES) c.room.strokes.shift()
    }
    socket.to(c.room.code).emit('board:stroke', s)
  })

  socket.on('board:undo', () => {
    const c = ctx()
    if (!c) return
    // Свой последний штрих; главный может отменить любой последний
    for (let i = c.room.strokes.length - 1; i >= 0; i--) {
      if (c.me.isHost || c.room.strokes[i].by === c.me.id) {
        const [s] = c.room.strokes.splice(i, 1)
        io.to(c.room.code).emit('board:remove', s.id)
        return
      }
    }
  })

  socket.on('board:clear', () => {
    const c = hostCtx()
    if (!c) return
    c.room.strokes = []
    io.to(c.room.code).emit('board:clear')
  })

  socket.on('slides:set', (slides, ack) => {
    const done = typeof ack === 'function' ? ack : () => {}
    const c = hostCtx()
    if (!c || !Array.isArray(slides)) return done(false)
    const ok = slides.slice(0, MAX_SLIDES).filter((s): s is string => typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(s))
    if (!ok.length) return done(false)
    c.room.stage = { ...c.room.stage, slides: ok, slide: 0, mode: 'slides', presenterId: null }
    emitStage(c.room)
    done(true)
  })

  socket.on('slides:goto', (index) => {
    const c = hostCtx()
    if (!c) return
    const i = Math.max(0, Math.min(c.room.stage.slides.length - 1, Math.floor(Number(index) || 0)))
    c.room.stage = { ...c.room.stage, slide: i }
    emitStage(c.room)
  })

  // ---------- игры ----------

  socket.on('game:propose', (gameId) => {
    const c = ctx()
    if (!c || !GAMES.some((g) => g.id === gameId)) return
    const set = c.room.proposals.get(gameId) ?? new Set<string>()
    c.room.proposals.set(gameId, set)
    if (set.has(c.me.id)) set.delete(c.me.id)
    else {
      set.add(c.me.id)
      system(c.room, `${c.me.name} предлагает сыграть: ${gameInfo(gameId).title}`)
    }
    emitProposals(c.room)
  })

  socket.on('game:start', (gameId) => {
    const c = hostCtx()
    if (!c || !GAMES.some((g) => g.id === gameId)) return
    const info = gameInfo(gameId)
    const players = people(c.room).sort((a, b) => a.seat - b.seat).map((p) => ({ id: p.id, name: p.name }))
    if (players.length < info.min) return void socket.emit('notice', `${info.title}: нужно минимум ${info.min} игрока`)
    if (players.length > info.max) return void socket.emit('notice', `${info.title}: максимум ${info.max} игроков`)
    try {
      const engine = ENGINES[gameId]
      c.room.game = { id: gameId, engine, state: engine.start(players) }
    } catch (e) {
      return void socket.emit('notice', (e as Error).message)
    }
    c.room.proposals.clear()
    emitProposals(c.room)
    system(c.room, `${c.me.name} начинает игру «${info.title}»`)
    emitGame(c.room)
  })

  socket.on('game:stop', () => {
    const c = hostCtx()
    if (!c || !c.room.game) return
    system(c.room, `Игра «${gameInfo(c.room.game.id).title}» завершена`)
    c.room.game = null
    emitGame(c.room)
  })

  socket.on('game:action', (action) => {
    const c = ctx()
    if (!c || !c.room.game || !action || typeof action !== 'object') return
    const err = c.room.game.engine.act(c.room.game.state, c.me.id, action as Record<string, unknown>, c.me.isHost)
    if (err) return void socket.emit('notice', err)
    emitGame(c.room)
  })

  socket.on('disconnect', () => leave(socket))
})

http.listen(PORT, () => console.log(`RoundTable server: http://localhost:${PORT}${authRequired ? ' (Firebase auth on)' : ''}`))

