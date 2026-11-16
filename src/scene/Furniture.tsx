import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, type Mesh, type MeshBasicMaterial } from 'three'
import type { Participant } from '../types'
import { SEAT_COUNT, TABLE_RADIUS, seatAngle, seatPosition, seatRotationY } from '../lib/seats'
import { participantLevel } from '../lib/media'
import { ChairModel } from './Props'

/** Цвет «ярче белого»: светится под bloom (toneMapped={false}), без bloom выглядит как обычный */
export const glow = (hex: string, k = 2.2) => new Color(hex).multiplyScalar(k)

const WOOD = '#6B4A33'
const WOOD_EDGE = '#4E3424'
const STEEL = '#2a2f3a'

export function Table() {
  const mint = useMemo(() => glow('#5EF2C7', 2.6), [])
  return (
    <group>
      {/* Столешница: тонкий верх + скошенная кромка */}
      <mesh position-y={0.765} castShadow receiveShadow>
        <cylinderGeometry args={[TABLE_RADIUS - 0.04, TABLE_RADIUS - 0.04, 0.03, 128]} />
        <meshStandardMaterial color={WOOD} roughness={0.32} metalness={0.05} />
      </mesh>
      <mesh position-y={0.725} castShadow receiveShadow>
        <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS - 0.07, 0.06, 128]} />
        <meshStandardMaterial color={WOOD_EDGE} roughness={0.4} />
      </mesh>
      {/* Неоновый кант под кромкой — светится */}
      <mesh position-y={0.69} rotation-x={Math.PI / 2}>
        <torusGeometry args={[TABLE_RADIUS - 0.08, 0.012, 8, 160]} />
        <meshBasicMaterial color={mint} toneMapped={false} />
      </mesh>
      {/* Латунная инкрустация: кольцо и восемь лучей к местам */}
      <mesh position-y={0.7815} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.9, 0.94, 96]} />
        <meshStandardMaterial color="#E0B15C" metalness={0.85} roughness={0.28} />
      </mesh>
      {Array.from({ length: SEAT_COUNT }, (_, i) => (
        <group key={i} rotation-y={seatAngle(i)}>
          <mesh position={[0, 0.7812, (0.94 + TABLE_RADIUS - 0.35) / 2]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.012, TABLE_RADIUS - 0.35 - 0.94]} />
            <meshStandardMaterial color="#E0B15C" metalness={0.85} roughness={0.28} />
          </mesh>
        </group>
      ))}
      {/* Опора: колонна с кольцами и широкое основание */}
      <mesh position-y={0.37} castShadow>
        <cylinderGeometry args={[0.26, 0.38, 0.66, 48]} />
        <meshStandardMaterial color={STEEL} metalness={0.65} roughness={0.35} />
      </mesh>
      {[0.12, 0.62].map((y) => (
        <mesh key={y} position-y={y} rotation-x={Math.PI / 2}>
          <torusGeometry args={[y < 0.5 ? 0.37 : 0.27, 0.014, 8, 48]} />
          <meshStandardMaterial color="#E0B15C" metalness={0.85} roughness={0.28} />
        </mesh>
      ))}
      <mesh position-y={0.035} receiveShadow castShadow>
        <cylinderGeometry args={[0.85, 0.95, 0.07, 64]} />
        <meshStandardMaterial color={STEEL} metalness={0.65} roughness={0.35} />
      </mesh>
    </group>
  )
}

/** Кольцо вокруг стула: тусклое у свободного, цвета участника у занятого, пульсирует от голоса */
function SeatRing({ occupant, main }: { occupant?: Participant; main: boolean }) {
  const ring = useRef<Mesh>(null!)
  const level = useRef(0)
  const color = useMemo(
    () => (occupant ? glow(occupant.color, 1.6) : new Color(main ? '#E0B15C' : '#A9B6CC')),
    [occupant?.color, main], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useFrame(({ clock }) => {
    const target = occupant ? participantLevel(occupant, clock.elapsedTime) : 0
    level.current += (target - level.current) * 0.25
    const mat = ring.current.material as MeshBasicMaterial
    const l = level.current
    ring.current.scale.setScalar(1 + l * 0.35)
    mat.opacity = occupant ? 0.35 + l * 0.65 : 0.12 + (main ? 0.1 : 0)
  })

  return (
    <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.02}>
      <ringGeometry args={[0.52, 0.6, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.15} toneMapped={false} />
    </mesh>
  )
}

function Chair({ index, occupant }: { index: number; occupant?: Participant }) {
  return (
    <group position={seatPosition(index)} rotation-y={seatRotationY(index)}>
      <SeatRing occupant={occupant} main={index === 0} />
      {/* Модель кресла из Blender (public/models/chair.glb); полоса на спинке — цвета сидящего */}
      <Suspense fallback={null}>
        <ChairModel main={index === 0} accent={occupant?.color} />
      </Suspense>
    </group>
  )
}

export function Chairs({ participants }: { participants: Participant[] }) {
  return (
    <>
      {Array.from({ length: SEAT_COUNT }, (_, i) => (
        <Chair key={i} index={i} occupant={participants.find((p) => p.seat === i)} />
      ))}
    </>
  )
}
