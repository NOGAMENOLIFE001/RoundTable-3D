import type { MafiaPhase, MafiaRole, MafiaView } from '../../shared/games'
import { pushLog, shuffle, type Engine, type Player } from './engine'

/**
 * Мафия. Роли раздаёт сервер. Фазы переключает главный:
 * ночь (мафия выбирает жертву, доктор лечит, шериф проверяет) → утро и обсуждение → голосование.
 * Ночь заканчивается сама, когда все ночные роли сделали ход.
 */
interface S {
  players: Player[]
  roles: Map<string, MafiaRole>
  alive: string[]
  phase: MafiaPhase
  round: number
  night: Map<string, string> // кто → цель (для мафии, доктора, шерифа)
  votes: Map<string, string | null>
  checks: Map<string, Map<string, boolean>> // шериф → проверки
  revealed: Map<string, MafiaRole>
  log: string[]
  over: boolean
  winner: 'mafia' | 'town' | null
  result?: string
}

const ROLE_NAME: Record<MafiaRole, string> = { mafia: 'мафия', sheriff: 'шериф', doctor: 'доктор', civilian: 'мирный житель' }
const name = (s: S, id: string) => s.players.find((p) => p.id === id)?.name ?? '?'
const aliveWith = (s: S, role: MafiaRole) => s.alive.filter((id) => s.roles.get(id) === role)

/** Ночные роли, которые должны сходить */
const nightActors = (s: S) => s.alive.filter((id) => s.roles.get(id) !== 'civilian')

function kill(s: S, id: string, how: string) {
  s.alive = s.alive.filter((x) => x !== id)
  const role = s.roles.get(id)!
  s.revealed.set(id, role)
  pushLog(s.log, `${name(s, id)} ${how}. Роль: ${ROLE_NAME[role]}`)
}

function checkWin(s: S) {
  const mafia = aliveWith(s, 'mafia').length
  const town = s.alive.length - mafia
  if (mafia === 0) s.winner = 'town'
  else if (mafia >= town) s.winner = 'mafia'
  if (s.winner) {
    s.over = true
    s.result = s.winner === 'town' ? 'Город победил: мафия поймана' : 'Мафия победила'
    pushLog(s.log, s.result)
    for (const [id, r] of s.roles) s.revealed.set(id, r)
  }
  return s.over
}

/** Цель мафии — по большинству голосов мафиози, при равенстве — последний выбор */
function mafiaTarget(s: S): string | null {
  const counts = new Map<string, number>()
  let last: string | null = null
  for (const id of aliveWith(s, 'mafia')) {
    const t = s.night.get(id)
    if (t) {
      counts.set(t, (counts.get(t) ?? 0) + 1)
      last = t
    }
  }
  let best = last
  let max = 0
  for (const [t, c] of counts) if (c > max) [best, max] = [t, c]
  return best
}

function morning(s: S) {
  const target = mafiaTarget(s)
  const healed = aliveWith(s, 'doctor').map((d) => s.night.get(d))
  for (const sh of aliveWith(s, 'sheriff')) {
    const t = s.night.get(sh)
    if (t) {
      if (!s.checks.has(sh)) s.checks.set(sh, new Map())
      s.checks.get(sh)!.set(t, s.roles.get(t) === 'mafia')
    }
  }
  pushLog(s.log, `Наступает утро ${s.round}-го дня`)
  if (target && !healed.includes(target)) kill(s, target, 'выбывает этой ночью')
  else pushLog(s.log, target ? 'Доктор спас жертву — этой ночью никто не погиб' : 'Этой ночью никто не погиб')
  s.night.clear()
  if (!checkWin(s)) s.phase = 'day'
}

function finishVote(s: S) {
  const counts = new Map<string, number>()
  for (const [, t] of s.votes) if (t) counts.set(t, (counts.get(t) ?? 0) + 1)
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (!sorted.length || (sorted[1] && sorted[1][1] === sorted[0][1])) {
    pushLog(s.log, 'Голоса разделились — никого не исключили')
  } else {
    kill(s, sorted[0][0], `выбывает по итогам голосования (${sorted[0][1]} гол.)`)
  }
  s.votes.clear()
  if (!checkWin(s)) {
    s.phase = 'night'
    s.round++
    pushLog(s.log, 'Город засыпает. Просыпается мафия')
  }
}

export const mafia: Engine<S> = {
  start(players) {
    const n = players.length
    if (n < 4) throw new Error('Для мафии нужно минимум 4 игрока')
    const roles: MafiaRole[] = []
    const mafiaCount = n >= 8 ? 2 : n >= 6 ? 2 : 1
    for (let i = 0; i < mafiaCount; i++) roles.push('mafia')
    roles.push('sheriff')
    if (n >= 5) roles.push('doctor')
    while (roles.length < n) roles.push('civilian')
    shuffle(roles)
    const s: S = {
      players, roles: new Map(players.map((p, i) => [p.id, roles[i]])), alive: players.map((p) => p.id),
      phase: 'night', round: 1, night: new Map(), votes: new Map(), checks: new Map(), revealed: new Map(),
      log: [], over: false, winner: null,
    }
    pushLog(s.log, `Роли розданы: мафия — ${mafiaCount}, шериф${n >= 5 ? ', доктор' : ''}. Город засыпает`)
    return s
  },

  act(s, by, a, isHost) {
    if (s.over) return 'Игра окончена'
    const type = a.type

    if (type === 'advance') {
      if (!isHost) return 'Фазы переключает главный'
      if (s.phase === 'night') morning(s)
      else if (s.phase === 'day') {
        s.phase = 'vote'
        pushLog(s.log, 'Голосование: кого исключаем?')
      } else finishVote(s)
      return
    }

    if (!s.alive.includes(by)) return 'Вы выбыли из игры'
    const target = typeof a.target === 'string' ? a.target : null

    if (type === 'night') {
      if (s.phase !== 'night') return 'Сейчас не ночь'
      const role = s.roles.get(by)
      if (role === 'civilian') return 'Мирные жители ночью спят'
      if (!target || !s.alive.includes(target)) return 'Выберите живого игрока'
      if (role === 'mafia' && s.roles.get(target) === 'mafia') return 'Нельзя выбрать своего'
      if (role === 'sheriff' && target === by) return 'Проверять себя бессмысленно'
      s.night.set(by, target)
      if (nightActors(s).every((id) => s.night.has(id))) morning(s)
      return
    }

    if (type === 'vote') {
      if (s.phase !== 'vote') return 'Голосование ещё не началось'
      if (target && !s.alive.includes(target)) return 'Можно голосовать только за живых'
      s.votes.set(by, target)
      if (s.alive.every((id) => s.votes.has(id))) finishVote(s)
      return
    }
    return 'Неизвестное действие'
  },

  view(s, viewer): MafiaView {
    const role = s.roles.get(viewer) ?? null
    const isMafia = role === 'mafia'
    const revealed: Record<string, MafiaRole> = Object.fromEntries(s.revealed)
    return {
      gameId: 'mafia',
      spectator: !s.roles.has(viewer),
      players: s.players.map((p) => ({
        id: p.id,
        out: !s.alive.includes(p.id),
        badge: !s.alive.includes(p.id)
          ? `☠ ${ROLE_NAME[s.revealed.get(p.id) ?? 'civilian']}`
          : s.phase === 'vote' && s.votes.has(p.id) ? '✓ голос' : undefined,
      })),
      log: s.log.slice(-10),
      over: s.over,
      result: s.result,
      round: s.round,
      phase: s.phase,
      role,
      alive: s.alive,
      revealed,
      team: isMafia ? [...s.roles].filter(([, r]) => r === 'mafia').map(([id]) => id) : [],
      myTarget: s.phase === 'night' ? s.night.get(viewer) ?? null : s.votes.get(viewer) ?? null,
      mafiaTarget: isMafia && s.phase === 'night' ? mafiaTarget(s) : null,
      votes: s.phase === 'vote' ? Object.fromEntries(s.votes) : {},
      checks: Object.fromEntries(s.checks.get(viewer) ?? []),
      waiting: s.phase === 'night' ? nightActors(s).filter((id) => !s.night.has(id)).length : 0,
      winner: s.winner,
    }
  },

  leave(s, id) {
    if (s.over || !s.alive.includes(id)) return
    kill(s, id, 'покидает комнату')
    s.night.delete(id)
    s.votes.delete(id)
    checkWin(s)
  },
}
