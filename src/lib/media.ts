import type { Participant } from '../types'
import { hashSeed } from './misc'

/**
 * Уровни громкости живут вне React-стейта: их читают каждый кадр в useFrame
 * (кольцо у стула, кивание головой). Пишут сюда анализаторы своего микрофона
 * и удалённых аудиопотоков WebRTC.
 */
const levels = new Map<string, number>()
export const setLevel = (id: string, v: number) => levels.set(id, v)
export const getLevel = (id: string) => levels.get(id) ?? 0

/** Имитация речи ботов: окна «разговора» + шум */
function botLevel(seed: number, t: number) {
  const talk = Math.sin(t * 0.35 + seed * 1.7) + Math.sin(t * 0.13 + seed * 3.1)
  if (talk < 1.15) return 0
  return 0.3 + 0.5 * Math.abs(Math.sin(t * 9 + seed)) * Math.abs(Math.sin(t * 3.3 + seed * 2))
}

export function participantLevel(p: Participant, t: number) {
  if (!p.micOn) return 0
  return p.isBot ? botLevel(hashSeed(p.id), t) : getLevel(p.id)
}

let ctx: AudioContext | null = null
/** Общий AudioContext. Браузер может запустить его только после жеста пользователя. */
export function audioContext() {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  return ctx
}

/**
 * Следить за громкостью потока и писать её в levels[id].
 * Анализ на таймере, а не на requestAnimationFrame, — чтобы работал и в фоновой вкладке.
 */
export function watchLevel(id: string, stream: MediaStream): () => void {
  const ac = audioContext()
  const analyser = ac.createAnalyser()
  analyser.fftSize = 512
  const source = ac.createMediaStreamSource(stream)
  source.connect(analyser)
  const buf = new Uint8Array(analyser.fftSize)
  const timer = setInterval(() => {
    analyser.getByteTimeDomainData(buf)
    let sum = 0
    for (const v of buf) {
      const d = (v - 128) / 128
      sum += d * d
    }
    const rms = Math.sqrt(sum / buf.length)
    setLevel(id, Math.min(1, Math.max(0, (rms - 0.015) * 7)))
  }, 50)
  return () => {
    clearInterval(timer)
    source.disconnect()
    setLevel(id, 0)
  }
}

let mic: { stream: MediaStream; unwatch: () => void } | null = null

/** Включить микрофон; возвращает аудиотрек для отправки участникам */
export async function startMic(id: string): Promise<MediaStreamTrack> {
  stopMic()
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
  mic = { stream, unwatch: watchLevel(id, stream) }
  return stream.getAudioTracks()[0]
}

export function stopMic() {
  if (!mic) return
  mic.unwatch()
  mic.stream.getTracks().forEach((t) => t.stop())
  mic = null
}

export const startCamera = () =>
  navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360, frameRate: 24, facingMode: 'user' } })

export const stopStream = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop())
