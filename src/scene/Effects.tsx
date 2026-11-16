import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard, Html } from '@react-three/drei'
import { Group, RepeatWrapping, SRGBColorSpace, Vector3, VideoTexture } from 'three'
import type { Participant, Reaction } from '../types'
import { seatPosition } from '../lib/seats'

/** Эмодзи взлетает над аватаром и тает */
function FloatingEmoji({ r, seat }: { r: Reaction; seat: number }) {
  const g = useRef<Group>(null!)
  const el = useRef<HTMLDivElement>(null)
  const [x, , z] = seatPosition(seat)
  const drift = useMemo(() => (Math.random() - 0.5) * 0.6, [])

  useFrame(() => {
    const k = Math.min(1, (Date.now() - r.ts) / 2400)
    g.current.position.set(x + drift * k, 1.9 + k * 1.6, z)
    if (el.current) {
      el.current.style.opacity = String(k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85)
      el.current.style.transform = `scale(${0.6 + Math.min(1, k * 5) * 0.6})`
    }
  })

  return (
    <group ref={g}>
      <Html center zIndexRange={[25, 0]} className="pointer-events-none select-none">
        <div ref={el} className="text-4xl drop-shadow-[0_4px_12px_rgba(0,0,0,.5)]">{r.emoji}</div>
      </Html>
    </group>
  )
}

export function Reactions({ reactions, participants }: { reactions: Reaction[]; participants: Participant[] }) {
  return (
    <>
      {reactions.map((r) => {
        const p = participants.find((x) => x.id === r.participantId)
        return p ? <FloatingEmoji key={r.id} r={r} seat={p.seat} /> : null
      })}
    </>
  )
}

/** Парящий экран с видео с веб-камеры над стулом участника */
export function VideoScreen({ stream, seat, mirror }: { stream: MediaStream; seat: number; mirror: boolean }) {
  const g = useRef<Group>(null!)
  const appear = useRef(0)
  const [x, , z] = seatPosition(seat, 2.6)

  // Видео и текстуру создаём в эффекте: так StrictMode (монтирование → размонтирование → монтирование)
  // не оставляет нас с уже остановленным <video>
  const [texture, setTexture] = useState<VideoTexture | null>(null)
  useEffect(() => {
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true // звук идёт отдельным <audio> из rtc.ts
    video.playsInline = true
    void video.play().catch(() => {})
    const t = new VideoTexture(video)
    t.colorSpace = SRGBColorSpace
    if (mirror) {
      t.wrapS = RepeatWrapping
      t.repeat.x = -1
      t.offset.x = 1
    }
    setTexture(t)
    return () => {
      video.pause()
      video.srcObject = null
      t.dispose()
    }
  }, [stream, mirror])

  useFrame(({ clock }, dt) => {
    appear.current = Math.min(1, appear.current + dt * 2.5)
    const a = appear.current
    const back = 1 + 2.7 * (a - 1) ** 3 + 1.7 * (a - 1) ** 2 // easeOutBack
    g.current.scale.setScalar(Math.max(0.001, back))
    g.current.position.y = 2.4 + Math.sin(clock.elapsedTime * 1.4) * 0.05
  })

  return (
    <group position={[x, 0, z]}>
      <group ref={g}>
        <Billboard>
          <mesh position-z={-0.01}>
            <planeGeometry args={[1.38, 0.82]} />
            <meshBasicMaterial color="#5EF2C7" transparent opacity={0.55} toneMapped={false} />
          </mesh>
          <mesh>
            <planeGeometry args={[1.3, 0.73]} />
            {texture ? (
              <meshBasicMaterial key={texture.uuid} map={texture} toneMapped={false} />
            ) : (
              <meshBasicMaterial key="empty" color="#0b1322" />
            )}
          </mesh>
        </Billboard>
      </group>
    </group>
  )
}

/** Камера: облёт сверху к виду из-за своего стула, дальше — свободное вращение */
export function CameraRig({ seat }: { seat: number | null }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void; enabled: boolean } | null
  const fly = useRef<{ from: Vector3; to: Vector3; t: number } | null>(null)

  useEffect(() => {
    if (seat == null) return
    const [x, , z] = seatPosition(seat, 1)
    fly.current = { from: camera.position.clone(), to: new Vector3(x * 6.6, 3.5, z * 6.6), t: 0 }
  }, [seat, camera])

  useFrame((_, dt) => {
    const f = fly.current
    if (!f || !controls) return
    f.t = Math.min(1, f.t + dt / 2.2)
    const k = 1 - (1 - f.t) ** 3
    camera.position.lerpVectors(f.from, f.to, k)
    camera.position.y += Math.sin(k * Math.PI) * 2.5 // дуга
    controls.target.set(0, 0.9, 0)
    controls.update()
    if (f.t >= 1) fly.current = null
  })

  return null
}
