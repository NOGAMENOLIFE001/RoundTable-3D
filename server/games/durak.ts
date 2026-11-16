import type { Card, DurakView, Suit } from '../../shared/games'
import { SUITS, cardName, deck36, pushLog, shuffle, takeFromHand, type Engine, type Player } from './engine'

/**
 * Дурак подкидной, 36 карт.
 * Атакует главный атакующий, подкидывать могут все, кроме защитника.
 * Карт на столе не больше 6 и не больше, чем было у защитника в начале хода.
 */
interface S {
  players: Player[]
  hands: Map<string, Card[]>
  deck: Card[] // козырь лежит в deck[0], берут с конца
  trump: Card
  /** Игроки, ещё не вышедшие из игры, в порядке мест */
  active: string[]
  attacker: string
  defender: string
  table: { a: Card; d?: Card }[]
  limit: number
  taken: boolean
  passed: Set<string>
  log: string[]
  over: boolean
  result?: string
  winners: string[]
}

const name = (s: S, id: string) => s.players.find((p) => p.id === id)?.name ?? '?'
const next = (s: S, id: string) => s.active[(s.active.indexOf(id) + 1) % s.active.length]

function beats(d: Card, a: Card, trump: Suit) {
  if (d.s === a.s) return d.r > a.r
  return d.s === trump && a.s !== trump
}

function refill(s: S, order: string[]) {
  for (const id of order) {
    const h = s.hands.get(id)!
    while (h.length < 6 && s.deck.length) h.push(s.deck.pop()!)
  }
}

function startRound(s: S, attacker: string) {
  s.attacker = attacker
  s.defender = next(s, attacker)
  s.table = []
  s.taken = false
  s.passed.clear()
  s.limit = Math.min(6, s.hands.get(s.defender)!.length)
}

/** Убрать тех, у кого кончились карты (колода пуста), проверить конец игры */
function settle(s: S) {
  if (s.deck.length === 0) {
    for (const id of [...s.active]) {
      if (s.hands.get(id)!.length === 0) {
        s.active = s.active.filter((x) => x !== id)
        s.winners.push(id)
        pushLog(s.log, `${name(s, id)} выходит из игры без карт`)
      }
    }
  }
  if (s.active.length <= 1) {
    s.over = true
    s.result = s.active.length === 1 ? `Дурак — ${name(s, s.active[0])}` : 'Ничья: все вышли одновременно'
    pushLog(s.log, s.result)
    return true
  }
  return false
}

function endRound(s: S) {
  const { attacker, defender } = s
  const cards = s.table.flatMap((p) => (p.d ? [p.a, p.d] : [p.a]))
  if (s.taken) {
    s.hands.get(defender)!.push(...cards)
    pushLog(s.log, `${name(s, defender)} забирает ${cards.length} карт`)
  } else {
    pushLog(s.log, 'Бито')
  }
  // Добор: атакующий, остальные по кругу, защитник последним
  const order = [attacker, ...s.active.filter((id) => id !== attacker && id !== defender), defender]
  refill(s, order)

  const nextAttacker = s.taken ? next(s, defender) : defender
  if (settle(s)) return
  // Если следующий атакующий уже вышел — ищем ближайшего активного по кругу мест
  let a = nextAttacker
  if (!s.active.includes(a)) {
    const ids = s.players.map((p) => p.id)
    let i = ids.indexOf(a)
    do i = (i + 1) % ids.length
    while (!s.active.includes(ids[i]))
    a = ids[i]
  }
  startRound(s, a)
}

const allDefended = (s: S) => s.table.length > 0 && s.table.every((p) => p.d)

/** Все подкидывающие сказали «пас» */
const allPassed = (s: S) => s.active.filter((id) => id !== s.defender).every((id) => s.passed.has(id))

export const durak: Engine<S> = {
  start(players) {
    if (players.length < 2 || players.length > 6) throw new Error('В дурака играют от 2 до 6 человек')
    const deck = shuffle(deck36())
    const s: S = {
      players, hands: new Map(players.map((p) => [p.id, [] as Card[]])), deck, trump: deck[0],
      active: players.map((p) => p.id), attacker: '', defender: '', table: [], limit: 6,
      taken: false, passed: new Set(), log: [], over: false, winners: [],
    }
    refill(s, s.active)
    // Первым ходит тот, у кого младший козырь
    let first = s.active[0]
    let low = 99
    for (const id of s.active) {
      for (const c of s.hands.get(id)!) if (c.s === s.trump.s && c.r < low) [low, first] = [c.r, id]
    }
    pushLog(s.log, `Козырь — ${cardName(s.trump)}. Первым ходит ${name(s, first)}`)
    startRound(s, first)
    return s
  },

  act(s, by, a) {
    if (s.over) return 'Игра окончена'
    if (!s.active.includes(by)) return 'Вы не участвуете в этой партии'
    const hand = s.hands.get(by)!
    const type = a.type

    if (type === 'attack') {
      if (by === s.defender) return 'Защитник не подкидывает'
      if (s.table.length === 0 && by !== s.attacker) return 'Первым ходит атакующий'
      if (s.table.length >= s.limit) return 'На столе уже максимум карт'
      const undefended = s.table.filter((p) => !p.d).length
      const defenderHand = s.hands.get(s.defender)!.length
      if (!s.taken && undefended >= defenderHand) return 'Защитнику нечем отбиваться'
      const c = takeFromHand(hand, a.card)
      if (!c) return 'Такой карты у вас нет'
      if (s.table.length > 0) {
        const ranks = new Set(s.table.flatMap((p) => (p.d ? [p.a.r, p.d.r] : [p.a.r])))
        if (!ranks.has(c.r)) {
          hand.push(c)
          return 'Подкидывать можно только карты того же достоинства, что на столе'
        }
      }
      s.table.push({ a: c })
      s.passed.clear()
      pushLog(s.log, `${name(s, by)}: ${cardName(c)}`)
      return
    }

    if (type === 'defend') {
      if (by !== s.defender) return 'Сейчас отбивается другой игрок'
      if (s.taken) return 'Вы уже решили взять карты'
      const idx = Number(a.index)
      const pair = s.table[idx]
      if (!pair || pair.d) return 'Выберите неотбитую карту'
      const c = takeFromHand(hand, a.card)
      if (!c) return 'Такой карты у вас нет'
      if (!beats(c, pair.a, s.trump.s)) {
        hand.push(c)
        return `${cardName(c)} не бьёт ${cardName(pair.a)}`
      }
      pair.d = c
      pushLog(s.log, `${name(s, by)} кроет ${cardName(pair.a)} картой ${cardName(c)}`)
      // Защитник отбил всё и карт больше нет — можно подкидывать дальше только до лимита
      if (allDefended(s) && (hand.length === 0 || s.table.length >= s.limit)) endRound(s)
      return
    }

    if (type === 'take') {
      if (by !== s.defender) return 'Брать может только защитник'
      if (allDefended(s)) return 'Всё отбито — брать нечего'
      s.taken = true
      s.passed.clear()
      pushLog(s.log, `${name(s, by)} берёт`)
      return
    }

    if (type === 'pass') {
      if (by === s.defender) return 'Защитник не пасует'
      if (s.table.length === 0) return 'Сначала нужно сходить'
      if (!s.taken && !allDefended(s)) return 'Дождитесь, пока защитник отобьётся или возьмёт'
      s.passed.add(by)
      if (allPassed(s)) endRound(s)
      return
    }
    return 'Неизвестное действие'
  },

  view(s, viewer): DurakView {
    const counts: Record<string, number> = {}
    for (const [id, h] of s.hands) counts[id] = h.length
    // Сортировка руки: по мастям, козыри в конце
    const order = (c: Card) => (c.s === s.trump.s ? 100 : SUITS.indexOf(c.s) * 15) + c.r
    return {
      gameId: 'durak',
      spectator: !s.hands.has(viewer),
      players: s.players.map((p) => ({
        id: p.id,
        out: !s.active.includes(p.id),
        badge: !s.active.includes(p.id)
          ? s.over && s.active[0] === p.id ? 'Дурак' : 'Вышел'
          : p.id === s.defender ? `🛡 ${counts[p.id]}` : p.id === s.attacker ? `⚔ ${counts[p.id]}` : `🂠 ${counts[p.id]}`,
      })),
      log: s.log.slice(-8),
      over: s.over,
      result: s.result,
      hand: [...(s.hands.get(viewer) ?? [])].sort((a, b) => order(a) - order(b)),
      counts,
      table: s.table,
      trump: s.trump,
      deck: s.deck.length,
      attacker: s.attacker,
      defender: s.defender,
      taken: s.taken,
      passed: [...s.passed],
    }
  },

  leave(s, id) {
    if (s.over || !s.active.includes(id)) return
    s.over = true
    s.result = `${name(s, id)} выходит из комнаты — партия остановлена`
    pushLog(s.log, s.result)
  },
}
