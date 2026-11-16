import { Suspense, lazy, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { detectQuality } from '../lib/quality'

const PostFX = lazy(() => import('./PostFX'))
import { useRoom } from '../store/useRoomStore'
import { Loft } from './Loft'
import { Chairs, Table } from './Furniture'
import { Avatar } from './Avatar'
import { CameraRig, Reactions, VideoScreen } from './Effects'
import { StageScreen } from './StageScreen'

export function RoomCanvas() {
  const participants = useRoom((s) => s.participants)
  const reactions = useRoom((s) => s.reactions)
  const selfId = useRoom((s) => s.selfId)
  const camStream = useRoom((s) => s.camStream)
  const remoteStreams = useRoom((s) => s.remoteStreams)
  const self = participants.find((p) => p.id === selfId)
  const game = useRoom((s) => s.game)
  const night = game?.gameId === 'mafia' && game.phase === 'night' && !game.over
  const badge = (id: string) => game?.players.find((p) => p.id === id)?.badge
  // HTML-подписи (drei <Html>) монтируем только после создания канваса,
  // иначе в первом коммите у них ещё нет DOM-контейнера и подпись теряется
  const [ready, setReady] = useState(false)
  const quality = useMemo(detectQuality, [])
  const high = quality === 'high'

  return (
    <Canvas
      shadows
      dpr={high ? [1, 2] : [1, 1.5]}
      camera={{ position: [0, 13, 13], fov: 50 }}
      aria-label="3D-комната с круглым столом"
      onCreated={(s) => {
        if (import.meta.env.DEV) Object.assign(window, { __three: s })
        setReady(true)
      }}
    >
      <Loft night={night} />
      <StageScreen />
      <Table />
      <Chairs participants={participants} />
      {ready && participants.map((p) => <Avatar key={p.id} p={p} isSelf={p.id === selfId} badge={badge(p.id)} />)}
      {ready && <Reactions reactions={reactions} participants={participants} />}
      {camStream && self && self.status !== 'leaving' && <VideoScreen stream={camStream} seat={self.seat} mirror />}
      {participants.map((p) => {
        const stream = remoteStreams[p.id]
        return p.id !== selfId && p.camOn && stream && p.status !== 'leaving' ? (
          <VideoScreen key={`v-${p.id}`} stream={stream} seat={p.seat} mirror={false} />
        ) : null
      })}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        minDistance={2.5}
        maxDistance={9}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.15}
        target={[0, 0.9, 0]}
      />
      <CameraRig seat={self?.seat ?? null} />
      {/* Свечение неона и мягкая виньетка — только на мощных устройствах */}
      {high && (
        <Suspense fallback={null}>
          <PostFX intensity={night ? 1.1 : 0.75} />
        </Suspense>
      )}
    </Canvas>
  )
}
