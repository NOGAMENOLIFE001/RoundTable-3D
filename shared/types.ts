export type AvatarStyle = 'classic' | 'robot' | 'round'
export type Hair = 'none' | 'short' | 'long' | 'bun' | 'mohawk' | 'curly'
export type Accessory = 'none' | 'glasses' | 'headphones' | 'cap' | 'crown' | 'bow'
export type Outfit = 'tee' | 'hoodie' | 'suit'

/** Внешность аватара — всё, что настраивается в редакторе персонажа */
export interface Appearance {
  /** Цвет одежды и неоновых акцентов */
  color: string
  style: AvatarStyle
  skin: string
  hair: Hair
  hairColor: string
  outfit: Outfit
  accessory: Accessory
}

export interface Profile extends Appearance {
  id: string
  name: string
}

/** entering: идёт к стулу и садится; seated: сидит; leaving: встаёт и исчезает */
export type ParticipantStatus = 'entering' | 'seated' | 'leaving'

export interface Participant extends Profile {
  seat: number
  isBot: boolean
  isHost: boolean
  status: ParticipantStatus
  micOn: boolean
  camOn: boolean
  handRaised: boolean
}

export interface ChatMessage {
  id: string
  authorId: string | null
  authorName: string
  color: string
  text: string
  ts: number
  system?: boolean
}

export interface Reaction {
  id: string
  participantId: string
  emoji: string
  ts: number
}

export interface Toast {
  id: string
  text: string
}

// ---------- Сцена: доска, демонстрация экрана, слайды ----------

export type StageMode = 'none' | 'board' | 'screen' | 'slides'

export interface StageState {
  mode: StageMode
  /** Кто показывает экран (для mode = 'screen') */
  presenterId: string | null
  /** Рисовать на доске могут все, а не только главный */
  boardOpen: boolean
  slides: string[]
  slide: number
}

/** Штрих на доске. Координаты нормированы в 0…1, пары x,y подряд. */
export interface Stroke {
  id: string
  by: string
  color: string
  width: number
  erase: boolean
  points: number[]
}
