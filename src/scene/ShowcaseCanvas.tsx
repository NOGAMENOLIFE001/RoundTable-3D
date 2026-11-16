import { Suspense, lazy } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { detectQuality } from '../lib/quality'

const PostFX = lazy(() => import('./PostFX'))
import type { Participant } from '../types'
import { DEFAULT_APPEARANCE } from '../../shared/protocol'
import { Loft } from './Loft'
import { Chairs, Table } from './Furniture'
import { Avatar } from './Avatar'

const demo: Participant[] = [
  { id: 'd1', name: 'Алия', color: '#5EF2C7', style: 'classic', hair: 'long', hairColor: '#1E1B1A', outfit: 'hoodie', accessory: 'headphones', seat: 1 },
  { id: 'd2', name: 'Тимур', color: '#E0B15C', style: 'robot', accessory: 'crown', seat: 3 },
  { id: 'd3', name: 'Ника', color: '#FF8FAB', style: 'classic', hair: 'bun', hairColor: '#C8963E', skin: '#B97F57', outfit: 'suit', accessory: 'glasses', seat: 6 },
].map((p) => ({ ...DEFAULT_APPEARANCE, ...p, isBot: true, isHost: false, status: 'seated', micOn: true, camOn: false, handRaised: false }) as Participant)

/** Фон экранов входа и лобби: тот же зал, медленный облёт */
export function ShowcaseCanvas() {
  const high = detectQuality() === 'high'
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [7, 4.2, 7], fov: 45 }}
      aria-hidden
      onCreated={(s) => {
        if (import.meta.env.DEV) Object.assign(window, { __three: s })
      }}
    >
      <Loft />
      <Table />
      <Chairs participants={demo} />
      {demo.map((p) => (
        <Avatar key={p.id} p={p} isSelf={false} showLabel={false} />
      ))}
      <OrbitControls autoRotate autoRotateSpeed={0.35} enableZoom={false} enableRotate={false} enablePan={false} target={[0, 0.6, 0]} />
      {high && (
        <Suspense fallback={null}>
          <PostFX intensity={0.7} darkness={0.6} />
        </Suspense>
      )}
    </Canvas>
  )
}
