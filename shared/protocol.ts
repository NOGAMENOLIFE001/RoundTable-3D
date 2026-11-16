import type { Appearance, ChatMessage, Participant, Profile, Reaction, StageMode, StageState, Stroke } from './types'
import type { GameId, GameView, Proposal } from './games'

/** Общие константы клиента и сервера */
export const SEAT_COUNT = 8
export const REACTIONS = ['👍', '👏', '😂', '🔥', '❤️', '🤔']
export const MAX_MESSAGE = 500
export const MAX_TOPIC = 80
export const MAX_NAME = 24
/** Сколько сервер держит стул занятым после ухода — пока клиенты доигрывают анимацию */
export const SEAT_RELEASE_MS = 1600
export const MAX_SLIDES = 40
/** Лимит на одно сообщение сокета (слайды в JPEG) */
export const MAX_SOCKET_BYTES = 12 * 1024 * 1024

/** Варианты для редактора персонажа (их же проверяет сервер) */
export const APPEARANCE_OPTIONS = {
  style: ['classic', 'robot', 'round'],
  hair: ['none', 'short', 'long', 'bun', 'mohawk', 'curly'],
  outfit: ['tee', 'hoodie', 'suit'],
  accessory: ['none', 'glasses', 'headphones', 'cap', 'crown', 'bow'],
} as const satisfies { [K in 'style' | 'hair' | 'outfit' | 'accessory']: readonly Appearance[K][] }

export const DEFAULT_APPEARANCE: Appearance = {
  color: '#5EF2C7', style: 'classic', skin: '#E9C8A8', hair: 'short', hairColor: '#3B2A20', outfit: 'tee', accessory: 'none',
}

/** Участник по сети. Статус анимации (entering/seated/leaving) клиент ведёт сам. */
export type ParticipantDTO = Omit<Participant, 'status'>

export interface RoomSnapshot {
  code: string
  topic: string
  participants: ParticipantDTO[]
  messages: ChatMessage[]
  stage: StageState
  strokes: Stroke[]
  proposals: Proposal[]
  game: GameView | null
}

export type JoinError = 'not_found' | 'full' | 'bad_request'

export type JoinResult =
  | { ok: true; selfId: string; room: RoomSnapshot }
  | { ok: false; error: JoinError }

/** Сообщение сигналинга WebRTC: SDP-описание или ICE-кандидат */
export interface RtcSignal {
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit | null
}

export type ProfileInput = Omit<Profile, 'id'>

export interface ClientToServerEvents {
  'room:create': (data: { profile: ProfileInput; topic: string }, ack: (r: JoinResult) => void) => void
  'room:join': (data: { profile: ProfileInput; code: string }, ack: (r: JoinResult) => void) => void
  'room:leave': () => void
  'room:topic': (topic: string) => void
  'profile:update': (profile: ProfileInput) => void
  'chat:send': (text: string) => void
  'hand:toggle': () => void
  /** Только изменившиеся поля — чтобы быстрые переключения не затирали друг друга */
  'media:update': (state: { micOn?: boolean; camOn?: boolean }) => void
  reaction: (emoji: string) => void
  /** Переслать сигнал WebRTC другому участнику этой же комнаты */
  'rtc:signal': (to: string, data: RtcSignal) => void

  // Сцена (управляет главный)
  'stage:mode': (mode: StageMode) => void
  'board:access': (open: boolean) => void
  /** Кусок штриха: точки дописываются к штриху с тем же id */
  'board:stroke': (s: Stroke) => void
  'board:undo': () => void
  'board:clear': () => void
  'slides:set': (slides: string[], ack: (ok: boolean) => void) => void
  'slides:goto': (index: number) => void

  // Игры
  'game:propose': (gameId: GameId) => void
  'game:start': (gameId: GameId) => void
  'game:stop': () => void
  'game:action': (action: unknown) => void
}

export interface ServerToClientEvents {
  'participant:joined': (p: ParticipantDTO) => void
  'participant:updated': (id: string, patch: Partial<ParticipantDTO>) => void
  'participant:left': (id: string) => void
  'chat:message': (m: ChatMessage) => void
  'room:topic': (topic: string) => void
  reaction: (r: Reaction) => void
  'rtc:signal': (from: string, data: RtcSignal) => void
  /** Короткое уведомление только этому клиенту (например, «нет мест») */
  notice: (text: string) => void

  stage: (s: StageState) => void
  'board:stroke': (s: Stroke) => void
  'board:remove': (strokeId: string) => void
  'board:clear': () => void

  'game:proposals': (p: Proposal[]) => void
  'game:view': (v: GameView | null) => void
}
