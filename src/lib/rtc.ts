import type { RtcSignal } from '../../shared/protocol'
import { audioContext, watchLevel } from './media'
import { socket } from './socket'

/**
 * WebRTC mesh: каждый с каждым (до 7 соединений на участника).
 *
 * Чтобы не было «встречных» offer'ов, соединение всегда начинает новичок:
 * он получает список сидящих за столом и шлёт каждому offer. В offer сразу
 * три канала: audio, камера, экран (sendrecv). Включение микрофона, камеры
 * и демонстрации экрана — это replaceTrack() на готовом канале, без повторного согласования.
 *
 * STUN по умолчанию — публичный Google. Для сетей за строгим NAT нужен TURN:
 * VITE_ICE_SERVERS='[{"urls":"turn:host:3478","username":"u","credential":"p"}]'
 */
function iceServers(): RTCIceServer[] {
  try {
    const raw = import.meta.env.VITE_ICE_SERVERS
    if (raw) return JSON.parse(raw) as RTCIceServer[]
  } catch {
    console.warn('VITE_ICE_SERVERS: невалидный JSON, используется STUN по умолчанию')
  }
  return [{ urls: 'stun:stun.l.google.com:19302' }]
}

/** Порядок каналов в соединении: он одинаковый у обеих сторон */
const SLOTS = ['audio', 'video', 'screen'] as const
type Slot = (typeof SLOTS)[number]

interface Peer {
  pc: RTCPeerConnection
  /** Входящие треки собеседника: голос + камера */
  stream: MediaStream
  /** Входящая демонстрация экрана */
  screen: MediaStream
  audio: HTMLAudioElement
  unwatch?: () => void
  /** Сигналы обрабатываем строго по очереди */
  queue: Promise<void>
  pendingCandidates: RTCIceCandidateInit[]
}

export interface RtcHooks {
  onRemoteStream: (id: string, stream: MediaStream | null) => void
  onRemoteScreen: (id: string, stream: MediaStream | null) => void
  onConnectionState: (id: string, state: RTCPeerConnectionState) => void
  onAutoplayBlocked: () => void
}

const peers = new Map<string, Peer>()
const local: Record<Slot, MediaStreamTrack | null> = { audio: null, video: null, screen: null }
let hooks: RtcHooks | null = null

export function initRtc(h: RtcHooks) {
  hooks = h
  socket.on('rtc:signal', handleSignal)
}

const send = (to: string, data: RtcSignal) => socket.emit('rtc:signal', to, data)

function enqueue(peer: Peer, job: () => Promise<void>) {
  peer.queue = peer.queue.then(job).catch((e) => console.warn('[rtc]', e))
}

const slotOf = (pc: RTCPeerConnection, t: RTCRtpTransceiver): Slot | undefined => SLOTS[pc.getTransceivers().indexOf(t)]

function createPeer(id: string): Peer {
  const pc = new RTCPeerConnection({ iceServers: iceServers() })
  const stream = new MediaStream()
  const screen = new MediaStream()
  const audio = new Audio()
  audio.autoplay = true
  audio.srcObject = stream
  const peer: Peer = { pc, stream, screen, audio, queue: Promise.resolve(), pendingCandidates: [] }
  peers.set(id, peer)

  pc.onicecandidate = (e) => {
    if (e.candidate) send(id, { candidate: e.candidate.toJSON() })
  }

  pc.ontrack = (e) => {
    if (slotOf(pc, e.transceiver) === 'screen') {
      if (!screen.getTracks().includes(e.track)) screen.addTrack(e.track)
      hooks?.onRemoteScreen(id, screen)
      return
    }
    if (!stream.getTracks().includes(e.track)) stream.addTrack(e.track)
    if (e.track.kind === 'audio') {
      peer.unwatch?.()
      peer.unwatch = watchLevel(id, new MediaStream([e.track]))
      audio.play().catch(() => hooks?.onAutoplayBlocked())
    }
    hooks?.onRemoteStream(id, stream)
  }

  pc.onconnectionstatechange = () => hooks?.onConnectionState(id, pc.connectionState)
  return peer
}

/** Новичок звонит тому, кто уже сидит за столом */
export function callPeer(id: string) {
  if (peers.has(id)) return
  const peer = createPeer(id)
  const { pc } = peer
  for (const slot of SLOTS) {
    const t = pc.addTransceiver(slot === 'audio' ? 'audio' : 'video', { direction: 'sendrecv' })
    void t.sender.replaceTrack(local[slot])
  }
  enqueue(peer, async () => {
    await pc.setLocalDescription(await pc.createOffer())
    send(id, { description: pc.localDescription!.toJSON() })
  })
}

function handleSignal(from: string, data: RtcSignal) {
  const peer = peers.get(from) ?? createPeer(from)
  const { pc } = peer
  enqueue(peer, async () => {
    if (data.description) {
      await pc.setRemoteDescription(data.description)
      if (data.description.type === 'offer') {
        // Отвечаем своими треками в те же каналы
        for (const t of pc.getTransceivers()) {
          const slot = slotOf(pc, t)
          if (!slot) continue
          t.direction = 'sendrecv'
          await t.sender.replaceTrack(local[slot])
        }
        await pc.setLocalDescription(await pc.createAnswer())
        send(from, { description: pc.localDescription!.toJSON() })
      }
      for (const c of peer.pendingCandidates.splice(0)) await pc.addIceCandidate(c).catch(() => {})
    } else if (data.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {})
      else peer.pendingCandidates.push(data.candidate)
    }
  })
}

/** Подменить свой трек (или убрать: null) во всех соединениях */
export async function setLocalTrack(slot: Slot, track: MediaStreamTrack | null) {
  local[slot] = track
  await Promise.all(
    [...peers.values()].flatMap(({ pc }) =>
      pc.getTransceivers()
        .filter((t) => slotOf(pc, t) === slot && t.direction !== 'stopped')
        .map((t) => t.sender.replaceTrack(track).catch((e) => console.warn('[rtc] replaceTrack', e))),
    ),
  )
}

export function closePeer(id: string) {
  const peer = peers.get(id)
  if (!peer) return
  peer.unwatch?.()
  peer.pc.close()
  peer.audio.pause()
  peer.audio.srcObject = null
  peers.delete(id)
  hooks?.onRemoteStream(id, null)
  hooks?.onRemoteScreen(id, null)
}

export function closeAll() {
  ;[...peers.keys()].forEach(closePeer)
  local.audio = null
  local.video = null
  local.screen = null
}

/** Повторить воспроизведение звука после жеста пользователя */
export function resumeAudio() {
  audioContext()
  peers.forEach((p) => void p.audio.play().catch(() => {}))
}

/** Для отладки и тестов */
export const rtcDebug = () =>
  [...peers.entries()].map(([id, p]) => ({
    id,
    state: p.pc.connectionState,
    tracks: p.stream.getTracks().map((t) => `${t.kind}:${t.muted ? 'muted' : 'live'}`),
  }))
