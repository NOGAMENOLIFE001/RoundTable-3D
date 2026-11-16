import { BUNKER_TRAITS, type BunkerTrait, type BunkerView } from '../../shared/games'
import { pushLog, shuffle, type Engine, type Player } from './engine'

/**
 * Бункер. Каждый получает карточку из 7 характеристик.
 * Раунд: все раскрывают по одной характеристике (в первом — профессию), затем голосование
 * за исключение. Фазы переключает главный. Игра идёт, пока живых больше, чем мест.
 */
const CATASTROPHES = [
  'Ядерная зима: поверхность непригодна для жизни 5 лет',
  'Пандемия неизвестного вируса: снаружи опасно 2 года',
  'Падение астероида: пыль закрыла солнце на 3 года',
  'Восстание машин: города захвачены роботами',
  'Глобальное наводнение: суша ушла под воду на годы',
  'Извержение супервулкана: пепел и холод на 4 года',
  'Нашествие гигантских насекомых: выходить можно только ночью',
]
const BUNKERS = [
  'Подземная лаборатория: запас еды на 3 года, есть медпункт и библиотека',
  'Бывшее бомбоубежище: генератор, оружейная, мало воды',
  'Частный бункер миллиардера: бассейн, теплица, нет врача',
  'Шахта: много места, запас консервов, плохая вентиляция',
  'Военный бункер: склад инструментов, рация, еды на 1 год',
]
const POOL: Record<BunkerTrait, string[]> = {
  bio: [],
  job: ['Врач-хирург', 'Инженер-электрик', 'Повар', 'Учитель физики', 'Фермер', 'Программист', 'Психолог', 'Военный', 'Строитель', 'Химик', 'Актёр', 'Механик', 'Ветеринар', 'Пилот', 'Юрист', 'Биолог', 'Сантехник', 'Блогер'],
  health: ['Полностью здоров', 'Астма', 'Близорукость', 'Диабет', 'Аллергия на пыль', 'Отличная физическая форма', 'Бессонница', 'Сломанная рука', 'Мигрени', 'Плохой слух'],
  hobby: ['Охота', 'Шахматы', 'Садоводство', 'Рисование', 'Игра на гитаре', 'Радиолюбитель', 'Кулинария', 'Йога', 'Рыбалка', 'Вязание', 'Скалолазание', 'Видеоигры'],
  phobia: ['Клаустрофобия', 'Боязнь темноты', 'Боязнь пауков', 'Боязнь крови', 'Боязнь одиночества', 'Боязнь высоты', 'Нет фобий', 'Боязнь громких звуков'],
  baggage: ['Аптечка', 'Семена овощей', 'Набор инструментов', 'Гитара', 'Рация', 'Ящик консервов', 'Ноутбук с солнечной панелью', 'Охотничье ружьё', 'Книга рецептов', 'Фильтр для воды', 'Палатка', 'Колода карт'],
  fact: ['Знает азбуку Морзе', 'Был чемпионом по плаванию', 'Умеет шить', 'Прошёл курс выживания', 'Говорит на 4 языках', 'Сидел в тюрьме', 'Может не спать двое суток', 'Умеет чинить генераторы', 'Боится признаться, что храпит', 'Умеет доить коров'],
}

interface S {
  players: Player[]
  cards: Map<string, Record<BunkerTrait, string>>
  open: Map<string, Partial<Record<BunkerTrait, string>>>
  alive: string[]
  places: number
  round: number
  phase: 'reveal' | 'vote'
  revealedThisRound: Set<string>
  votes: Map<string, string | null>
  catastrophe: string
  bunker: string
  log: string[]
  over: boolean
  result?: string
}

const name = (s: S, id: string) => s.players.find((p) => p.id === id)?.name ?? '?'
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
const label = (t: BunkerTrait) => BUNKER_TRAITS.find((x) => x.id === t)!.label

function bio() {
  const age = 18 + Math.floor(Math.random() * 60)
  return `${Math.random() < 0.5 ? 'Мужчина' : 'Женщина'}, ${age} лет`
}

function finish(s: S) {
  s.over = true
  s.result = `В бункер попали: ${s.alive.map((id) => name(s, id)).join(', ')}`
  pushLog(s.log, s.result)
  // В конце открываем все карточки
  for (const [id, c] of s.cards) s.open.set(id, { ...c })
}

function closeVote(s: S) {
  const counts = new Map<string, number>()
  for (const [, t] of s.votes) if (t) counts.set(t, (counts.get(t) ?? 0) + 1)
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (!sorted.length || (sorted[1] && sorted[1][1] === sorted[0][1])) {
    pushLog(s.log, 'Голоса разделились — никто не исключён')
  } else {
    const [id, n] = sorted[0]
    s.alive = s.alive.filter((x) => x !== id)
    pushLog(s.log, `${name(s, id)} не попадает в бункер (${n} гол.)`)
  }
  s.votes.clear()
  if (s.alive.length <= s.places) return finish(s)
  s.round++
  s.phase = 'reveal'
  s.revealedThisRound.clear()
  pushLog(s.log, `Раунд ${s.round}: раскройте ещё одну характеристику`)
}

export const bunker: Engine<S> = {
  start(players) {
    if (players.length < 4) throw new Error('Для бункера нужно минимум 4 игрока')
    const decks = Object.fromEntries(
      (Object.keys(POOL) as BunkerTrait[]).map((k) => [k, shuffle([...POOL[k]])]),
    ) as Record<BunkerTrait, string[]>
    const s: S = {
      players,
      cards: new Map(players.map((p) => [p.id, {
        bio: bio(), job: decks.job.pop() ?? pick(POOL.job), health: decks.health.pop() ?? pick(POOL.health),
        hobby: decks.hobby.pop() ?? pick(POOL.hobby), phobia: decks.phobia.pop() ?? pick(POOL.phobia),
        baggage: decks.baggage.pop() ?? pick(POOL.baggage), fact: decks.fact.pop() ?? pick(POOL.fact),
      }])),
      open: new Map(players.map((p) => [p.id, {}])),
      alive: players.map((p) => p.id),
      places: Math.floor(players.length / 2),
      round: 1,
      phase: 'reveal',
      revealedThisRound: new Set(),
      votes: new Map(),
      catastrophe: pick(CATASTROPHES),
      bunker: pick(BUNKERS),
      log: [],
      over: false,
    }
    pushLog(s.log, `Мест в бункере: ${s.places}. Раунд 1: все раскрывают профессию`)
    return s
  },

  act(s, by, a, isHost) {
    if (s.over) return 'Игра окончена'
    if (a.type === 'advance') {
      if (!isHost) return 'Фазы переключает главный'
      if (s.phase === 'reveal') {
        s.phase = 'vote'
        pushLog(s.log, 'Голосование: кто не попадает в бункер?')
      } else closeVote(s)
      return
    }
    if (!s.alive.includes(by)) return 'Вы уже вне игры'

    if (a.type === 'reveal') {
      if (s.phase !== 'reveal') return 'Сейчас не время раскрываться'
      if (s.revealedThisRound.has(by)) return 'В этом раунде вы уже раскрылись'
      const t = a.trait as BunkerTrait
      if (!BUNKER_TRAITS.some((x) => x.id === t)) return 'Неизвестная характеристика'
      if (s.round === 1 && t !== 'job') return 'В первом раунде раскрывают профессию'
      const open = s.open.get(by)!
      if (open[t]) return 'Эта характеристика уже открыта'
      open[t] = s.cards.get(by)![t]
      s.revealedThisRound.add(by)
      pushLog(s.log, `${name(s, by)} раскрывает «${label(t)}»: ${open[t]}`)
      // Все раскрылись — сразу к голосованию
      if (s.alive.every((id) => s.revealedThisRound.has(id))) {
        s.phase = 'vote'
        pushLog(s.log, 'Все раскрылись. Голосование: кто не попадает в бункер?')
      }
      return
    }

    if (a.type === 'vote') {
      if (s.phase !== 'vote') return 'Голосование ещё не началось'
      const target = typeof a.target === 'string' ? a.target : null
      if (target && !s.alive.includes(target)) return 'Голосовать можно только за тех, кто в игре'
      if (target === by) return 'За себя голосовать нельзя'
      s.votes.set(by, target)
      if (s.alive.every((id) => s.votes.has(id))) closeVote(s)
      return
    }
    return 'Неизвестное действие'
  },

  view(s, viewer): BunkerView {
    return {
      gameId: 'bunker',
      spectator: !s.cards.has(viewer),
      players: s.players.map((p) => ({
        id: p.id,
        out: !s.alive.includes(p.id),
        badge: !s.alive.includes(p.id)
          ? s.over ? 'Снаружи' : 'Исключён'
          : s.over ? 'В бункере'
          : s.phase === 'vote' ? (s.votes.has(p.id) ? '✓ голос' : '…') : s.revealedThisRound.has(p.id) ? '✓' : '…',
      })),
      log: s.log.slice(-10),
      over: s.over,
      result: s.result,
      catastrophe: s.catastrophe,
      bunker: s.bunker,
      places: s.places,
      round: s.round,
      phase: s.phase,
      alive: s.alive,
      open: Object.fromEntries(s.open),
      mine: s.cards.get(viewer) ?? {},
      revealedThisRound: [...s.revealedThisRound],
      votes: s.phase === 'vote' ? Object.fromEntries(s.votes) : {},
    }
  },

  leave(s, id) {
    if (s.over || !s.alive.includes(id)) return
    s.alive = s.alive.filter((x) => x !== id)
    s.votes.delete(id)
    pushLog(s.log, `${name(s, id)} покидает комнату`)
    if (s.alive.length <= s.places) finish(s)
  },
}
