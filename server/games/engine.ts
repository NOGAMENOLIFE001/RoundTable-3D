import type { Card, GameView, Suit } from '../../shared/games'

export interface Player {
  id: string
  name: string
}

/**
 * Движок игры живёт только на сервере. view() собирает то, что видит
 * конкретный участник: свои карты и роль — только ему.
 */
export interface Engine<S> {
  start(players: Player[]): S
  /** Возвращает текст ошибки, если ход недопустим */
  act(state: S, by: string, action: Record<string, unknown>, isHost: boolean): string | void
  view(state: S, viewer: string): GameView
  /** Игрок вышел из комнаты посреди игры */
  leave(state: S, id: string): void
}

export const SUITS: Suit[] = ['♠', '♥', '♦', '♣']

export function deck36(): Card[] {
  const d: Card[] = []
  for (const s of SUITS) for (let r = 6; r <= 14; r++) d.push({ s, r })
  return d
}

export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const sameCard = (a: Card, b: Card) => a.s === b.s && a.r === b.r

/** Карта из действия игрока — только если она действительно у него в руке */
export function takeFromHand(hand: Card[], raw: unknown): Card | null {
  const c = raw as Partial<Card> | null
  if (!c || typeof c.r !== 'number' || typeof c.s !== 'string') return null
  const i = hand.findIndex((h) => h.r === c.r && h.s === c.s)
  return i < 0 ? null : hand.splice(i, 1)[0]
}

export const RANK_NAME: Record<number, string> = {
  6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'валет', 12: 'дама', 13: 'король', 14: 'туз',
}
export const cardName = (c: Card) => `${RANK_NAME[c.r]}${c.s}`

export function pushLog(log: string[], line: string) {
  log.push(line)
  if (log.length > 30) log.splice(0, log.length - 30)
}
