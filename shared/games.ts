/** Каталог игр и то, что сервер показывает каждому игроку (свои карты и роли — только себе) */

export type GameId = 'durak' | 'pikdama' | 'mafia' | 'bunker'

export interface GameInfo {
  id: GameId
  title: string
  description: string
  min: number
  max: number
  emoji: string
}

export const GAMES: GameInfo[] = [
  { id: 'durak', title: 'Дурак подкидной', emoji: '🃏', min: 2, max: 6, description: 'Отбивайтесь, подкидывайте и избавьтесь от карт раньше всех.' },
  { id: 'pikdama', title: 'Пиковая дама', emoji: '♠️', min: 2, max: 8, description: 'Тяните карты у соседа и собирайте пары. Проиграет тот, у кого останется дама пик.' },
  { id: 'mafia', title: 'Мафия', emoji: '🕵️', min: 4, max: 8, description: 'Роли раздаются тайно. Ночью действует мафия, днём город голосует.' },
  { id: 'bunker', title: 'Бункер', emoji: '☢️', min: 4, max: 8, description: 'Катастрофа, мест мало. Раскрывайте карты и решайте, кто попадёт в бункер.' },
]

export const gameInfo = (id: GameId) => GAMES.find((g) => g.id === id)!

export interface Proposal {
  gameId: GameId
  /** id участников, предложивших игру */
  by: string[]
}

// ---------- карты ----------

export type Suit = '♠' | '♥' | '♦' | '♣'
/** Ранг 6…14 (11 — валет, 12 — дама, 13 — король, 14 — туз) */
export interface Card {
  s: Suit
  r: number
}
export const cardId = (c: Card) => `${c.r}${c.s}`
export const RANK_LABEL: Record<number, string> = { 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'В', 12: 'Д', 13: 'К', 14: 'Т' }
export const isRed = (s: Suit) => s === '♥' || s === '♦'

/** Общая часть вида любой игры */
interface BaseView {
  gameId: GameId
  /** Участвует ли зритель (вошёл после начала) */
  spectator: boolean
  players: { id: string; badge?: string; out?: boolean }[]
  log: string[]
  over: boolean
  result?: string
}

export interface DurakView extends BaseView {
  gameId: 'durak'
  hand: Card[]
  counts: Record<string, number>
  table: { a: Card; d?: Card }[]
  trump: Card
  deck: number
  attacker: string
  defender: string
  taken: boolean
  passed: string[]
}

export interface PikDamaView extends BaseView {
  gameId: 'pikdama'
  hand: Card[]
  counts: Record<string, number>
  turn: string
  /** У кого текущий игрок тянет карту */
  from: string
  /** Последняя вытянутая вами карта — чтобы показать её */
  drawn?: Card
}

export type MafiaRole = 'mafia' | 'sheriff' | 'doctor' | 'civilian'
export type MafiaPhase = 'night' | 'day' | 'vote'
export interface MafiaView extends BaseView {
  gameId: 'mafia'
  round: number
  phase: MafiaPhase
  role: MafiaRole | null
  alive: string[]
  /** Роли раскрываются после смерти и в конце игры */
  revealed: Record<string, MafiaRole>
  /** Союзники-мафиози (видит только мафия) */
  team: string[]
  /** Мой ночной выбор / голос днём */
  myTarget: string | null
  /** Выбор мафии этой ночью (видит только мафия) */
  mafiaTarget: string | null
  /** Голоса днём: кто → за кого (null — воздержался) */
  votes: Record<string, string | null>
  /** Проверки шерифа: id → мафия ли */
  checks: Record<string, boolean>
  /** Кто ещё не сделал ночной ход (без раскрытия ролей — только число) */
  waiting: number
  winner: 'mafia' | 'town' | null
}

export type BunkerTrait = 'bio' | 'job' | 'health' | 'hobby' | 'phobia' | 'baggage' | 'fact'
export const BUNKER_TRAITS: { id: BunkerTrait; label: string }[] = [
  { id: 'job', label: 'Профессия' },
  { id: 'bio', label: 'Биология' },
  { id: 'health', label: 'Здоровье' },
  { id: 'hobby', label: 'Хобби' },
  { id: 'phobia', label: 'Фобия' },
  { id: 'baggage', label: 'Багаж' },
  { id: 'fact', label: 'Факт' },
]
export interface BunkerView extends BaseView {
  gameId: 'bunker'
  catastrophe: string
  bunker: string
  places: number
  round: number
  phase: 'reveal' | 'vote'
  alive: string[]
  /** Открытые всем характеристики */
  open: Record<string, Partial<Record<BunkerTrait, string>>>
  /** Моя карточка целиком */
  mine: Partial<Record<BunkerTrait, string>>
  /** Кто уже раскрылся в этом раунде */
  revealedThisRound: string[]
  votes: Record<string, string | null>
}

export type GameView = DurakView | PikDamaView | MafiaView | BunkerView
