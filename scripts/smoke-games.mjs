// Смоук-тест игр: 4 клиента заходят в комнату и доигрывают каждую игру до конца.
// Запуск при работающем сервере: npm run test:games  (сервер — npm run dev или npm run dev:server)
import { io } from 'socket.io-client'

const URL = process.env.SERVER_URL ?? 'http://localhost:3001'
const look = { color: '#5EF2C7', style: 'classic', skin: '#E9C8A8', hair: 'short', hairColor: '#3B2A20', outfit: 'tee', accessory: 'none' }
const names = ['Аня', 'Борис', 'Вика', 'Гоша']

const connect = () => new Promise((res, rej) => {
  const s = io(URL, { transports: ['websocket'], forceNew: true })
  s.views = []
  s.on('game:view', (v) => (s.view = v))
  s.on('notice', (n) => (s.lastNotice = n))
  s.once('connect', () => res(s))
  s.once('connect_error', rej)
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const act = async (s, a) => { s.lastNotice = null; s.emit('game:action', a); await wait(40) }

const clients = await Promise.all(names.map(connect))
const [host, ...rest] = clients
const created = await host.timeout(3000).emitWithAck('room:create', { profile: { name: names[0], ...look }, topic: 'Тест игр' })
for (let i = 0; i < rest.length; i++) {
  const r = await rest[i].timeout(3000).emitWithAck('room:join', { profile: { name: names[i + 1], ...look }, code: created.room.code })
  if (!r.ok) throw new Error('join failed ' + r.error)
}
const ids = new Map(clients.map((c) => [c.id, c]))
let failures = 0
const check = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) failures++ }

async function start(gameId) {
  rest[0].emit('game:propose', gameId)
  await wait(60)
  host.emit('game:start', gameId)
  await wait(120)
  check(clients.every((c) => c.view?.gameId === gameId), `${gameId}: игра началась у всех`)
}

// ---------- Пиковая дама: тянем первую карту, пока не кончится ----------
await start('pikdama')
for (let i = 0; i < 400 && !host.view.over; i++) {
  const turn = ids.get(host.view.turn)
  await act(turn, { type: 'draw', index: 0 })
}
check(host.view.over && /дама/.test(host.view.result), `pikdama: доиграли — ${host.view.result}`)
check(Object.values(host.view.counts).reduce((a, b) => a + b, 0) === 1, 'pikdama: осталась одна карта (дама пик)')

// ---------- Дурак: простая стратегия — ходить младшей, отбиваться первой подходящей, иначе брать ----------
host.emit('game:stop'); await wait(60)
await start('durak')
const beats = (d, a, t) => (d.s === a.s ? d.r > a.r : d.s === t && a.s !== t)
for (let step = 0; step < 3000 && !host.view.over; step++) {
  const v = host.view
  const def = ids.get(v.defender)
  const dv = def.view
  const open = dv.table.findIndex((p) => !p.d)
  if (open >= 0 && !dv.taken) {
    const card = dv.hand.find((c) => beats(c, dv.table[open].a, dv.trump.s))
    if (card) await act(def, { type: 'defend', index: open, card })
    else await act(def, { type: 'take' })
    continue
  }
  const att = ids.get(v.attacker)
  if (v.table.length === 0) { await act(att, { type: 'attack', card: att.view.hand[0] }); continue }
  // Подкидываем по очереди, иначе пас
  let moved = false
  for (const c of clients) {
    if (c.id === v.defender || !c.view.hand.length || v.passed.includes(c.id)) continue
    const ranks = new Set(v.table.flatMap((p) => (p.d ? [p.a.r, p.d.r] : [p.a.r])))
    const card = c.view.hand.find((h) => ranks.has(h.r))
    if (card && v.table.length < 6) { await act(c, { type: 'attack', card }); if (!c.lastNotice) { moved = true; break } }
  }
  if (!moved) for (const c of clients) if (c.id !== v.defender && !host.view.passed.includes(c.id)) await act(c, { type: 'pass' })
}
check(host.view.over, `durak: доиграли — ${host.view.result}`)

// ---------- Мафия: ночью мафия бьёт первого мирного, днём все голосуют за первого живого не-себя ----------
host.emit('game:stop'); await wait(60)
await start('mafia')
const roles = new Map(clients.map((c) => [c.id, c.view.role]))
check([...roles.values()].filter((r) => r === 'mafia').length === 1, 'mafia: одна мафия на 4 игроков')
check(clients.every((c) => c.view.role && (c.view.role === 'mafia' ? c.view.team.length === 1 : c.view.team.length === 0)), 'mafia: роли видны только себе')
for (let round = 0; round < 10 && !host.view.over; round++) {
  if (host.view.phase === 'night') {
    for (const c of clients) {
      const v = c.view
      if (!v.alive.includes(c.id) || v.role === 'civilian') continue
      const target = v.role === 'mafia' ? v.alive.find((id) => roles.get(id) !== 'mafia') : v.role === 'doctor' ? c.id : v.alive.find((id) => id !== c.id)
      await act(c, { type: 'night', target })
    }
  }
  if (host.view.over) break
  if (host.view.phase === 'day') await act(host, { type: 'advance' })
  if (host.view.phase === 'vote') {
    const alive = host.view.alive
    const victim = alive.find((id) => roles.get(id) === 'mafia') ?? alive[0]
    for (const c of clients) if (alive.includes(c.id)) await act(c, { type: 'vote', target: c.id === victim ? alive.find((x) => x !== victim) : victim })
  }
}
check(host.view.over && host.view.winner, `mafia: доиграли — ${host.view.result}`)

// ---------- Бункер ----------
host.emit('game:stop'); await wait(60)
await start('bunker')
check(host.view.places === 2, 'bunker: 2 места на 4 игроков')
await act(rest[0], { type: 'reveal', trait: 'hobby' })
check(!!rest[0].lastNotice, 'bunker: в первом раунде нельзя раскрыть не профессию')
for (let round = 0; round < 10 && !host.view.over; round++) {
  for (const c of clients) {
    const v = c.view
    if (!v.alive.includes(c.id) || v.phase !== 'reveal') continue
    const trait = v.round === 1 ? 'job' : ['bio', 'health', 'hobby', 'phobia', 'baggage', 'fact'].find((t) => !v.open[c.id]?.[t])
    await act(c, { type: 'reveal', trait })
  }
  const alive = host.view.alive
  for (const c of clients) if (alive.includes(c.id)) await act(c, { type: 'vote', target: alive.find((x) => x !== c.id && x !== host.id) ?? alive.find((x) => x !== c.id) })
}
check(host.view.over && host.view.alive.length === 2, `bunker: доиграли — ${host.view.result}`)

// ---------- Только главный запускает игру ----------
host.emit('game:stop'); await wait(60)
rest[1].lastNotice = null
rest[1].emit('game:start', 'durak'); await wait(80)
check(!rest[1].view && /главный/.test(rest[1].lastNotice ?? ''), 'не-главный не может начать игру')

clients.forEach((c) => c.disconnect())
console.log(failures ? `\n${failures} проверок не прошло` : '\nВсе проверки пройдены')
process.exit(failures ? 1 : 0)
