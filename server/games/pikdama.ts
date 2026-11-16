import type { Card, PikDamaView } from '../../shared/games'
import { SUITS, deck36, pushLog, shuffle, type Engine, type Player } from './engine'

/**
 * Пиковая дама: из колоды убирают даму треф, раздают все карты.
 * Пары одного достоинства сбрасываются. По очереди тянут карту у следующего игрока.
 * Кто остался с дамой пик — проиграл.
 */
interface S {
  players: Player[]
  hands: Map<string, Card[]>
  active: string[]
  turn: string
  log: string[]
  over: boolean
  result?: string
  lastDrawn: Map<string, Card>
}

const name = (s: S, id: string) => s.players.find((p) => p.id === id)?.name ?? '?'
const nextActive = (s: S, id: string) => s.active[(s.active.indexOf(id) + 1) % s.active.length]

/** Сбросить пары; возвращает число сброшенных пар */
function dropPairs(hand: Card[]): number {
  let pairs = 0
  for (let r = 6; r <= 14; r++) {
    let same = hand.filter((c) => c.r === r)
    while (same.length >= 2) {
      for (const c of same.slice(0, 2)) hand.splice(hand.indexOf(c), 1)
      same = same.slice(2)
      pairs++
    }
  }
  return pairs
}

function settle(s: S) {
  for (const id of [...s.active]) {
    if (s.hands.get(id)!.length === 0 && s.active.length > 1) {
      s.active = s.active.filter((x) => x !== id)
      pushLog(s.log, `${name(s, id)} избавляется от всех карт`)
    }
  }
  if (s.active.length <= 1) {
    s.over = true
    s.result = s.active.length ? `Пиковая дама осталась у игрока ${name(s, s.active[0])}` : 'Игра окончена'
    pushLog(s.log, s.result)
  }
}

export const pikdama: Engine<S> = {
  start(players) {
    if (players.length < 2) throw new Error('Нужно минимум 2 игрока')
    const deck = shuffle(deck36().filter((c) => !(c.r === 12 && c.s === '♣')))
    const s: S = {
      players, hands: new Map(players.map((p) => [p.id, [] as Card[]])), active: players.map((p) => p.id),
      turn: players[0].id, log: [], over: false, lastDrawn: new Map(),
    }
    deck.forEach((c, i) => s.hands.get(players[i % players.length].id)!.push(c))
    for (const [, h] of s.hands) dropPairs(h)
    pushLog(s.log, 'Карты розданы, пары сброшены')
    settle(s)
    if (!s.over) {
      s.turn = s.active[Math.floor(Math.random() * s.active.length)]
      pushLog(s.log, `Первым тянет ${name(s, s.turn)}`)
    }
    return s
  },

  act(s, by, a) {
    if (s.over) return 'Игра окончена'
    if (a.type !== 'draw') return 'Неизвестное действие'
    if (by !== s.turn) return 'Сейчас тянет другой игрок'
    const from = nextActive(s, by)
    const src = s.hands.get(from)!
    const idx = Number(a.index)
    if (!Number.isInteger(idx) || idx < 0 || idx >= src.length) return 'Выберите карту'
    const [card] = src.splice(idx, 1)
    shuffle(src) // чтобы позиция дамы не запоминалась
    const hand = s.hands.get(by)!
    hand.push(card)
    s.lastDrawn.set(by, card)
    const pairs = dropPairs(hand)
    pushLog(s.log, `${name(s, by)} тянет карту у игрока ${name(s, from)}${pairs ? ' и сбрасывает пару' : ''}`)
    settle(s)
    if (!s.over) s.turn = s.active.includes(by) ? nextActive(s, by) : s.active.includes(from) ? from : s.active[0]
  },

  view(s, viewer): PikDamaView {
    const counts: Record<string, number> = {}
    for (const [id, h] of s.hands) counts[id] = h.length
    const sorted = [...(s.hands.get(viewer) ?? [])].sort((a, b) => a.r - b.r || SUITS.indexOf(a.s) - SUITS.indexOf(b.s))
    return {
      gameId: 'pikdama',
      spectator: !s.hands.has(viewer),
      players: s.players.map((p) => ({
        id: p.id,
        out: !s.active.includes(p.id),
        badge: s.over && s.active[0] === p.id ? '♠ Дама' : !s.active.includes(p.id) ? 'Без карт' : `${p.id === s.turn ? '👉 ' : ''}🂠 ${counts[p.id]}`,
      })),
      log: s.log.slice(-8),
      over: s.over,
      result: s.result,
      hand: sorted,
      counts,
      turn: s.turn,
      from: s.over ? '' : nextActive(s, s.turn),
      drawn: s.lastDrawn.get(viewer),
    }
  },

  leave(s, id) {
    if (s.over || !s.active.includes(id)) return
    s.over = true
    s.result = `${name(s, id)} выходит из комнаты — партия остановлена`
    pushLog(s.log, s.result)
  },
}

