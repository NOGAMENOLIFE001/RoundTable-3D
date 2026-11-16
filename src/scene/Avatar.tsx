import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { Group, MathUtils, Mesh, MeshStandardMaterial, Vector3, type BufferGeometry, type Material } from 'three'
import { Crown, Hand, MicOff } from 'lucide-react'
import type { Appearance, Participant } from '../types'
import {
  FRONT_RADIUS, buildEntryPath, pathLength, samplePath, seatPosition, seatRotationY,
} from '../lib/seats'
import { participantLevel } from '../lib/media'
import { hashSeed } from '../lib/misc'
import { useRoom } from '../store/useRoomStore'

const WALK_SPEED = 2.2 // м/с
const SIT_TIME = 0.7 // с — должно укладываться в LEAVE_MS вместе с FADE_TIME
const FADE_TIME = 0.5
const PELVIS_STAND = 0.9
const PELVIS_SIT = 0.52

type Phase = 'walk' | 'sit' | 'seated' | 'stand' | 'fade' | 'gone'

/** Кости аватара, которыми управляет анимация */
interface Rig {
  pelvis: Group
  torso: Group
  head: Group
  shL: Group
  shR: Group
  hipL: Group
  hipR: Group
  kneeL: Group
  kneeR: Group
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const angleLerp = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k

function useMaterials(a: Appearance) {
  const mats = useMemo(
    () => ({
      body: new MeshStandardMaterial({ color: a.color, roughness: 0.5, transparent: true }),
      skin: new MeshStandardMaterial({ color: a.skin, roughness: 0.55, transparent: true }),
      hair: new MeshStandardMaterial({ color: a.hairColor, roughness: 0.7, transparent: true }),
      dark: new MeshStandardMaterial({ color: '#1c2233', roughness: 0.5, transparent: true }),
      white: new MeshStandardMaterial({ color: '#F3F6FB', roughness: 0.3, transparent: true }),
      metal: new MeshStandardMaterial({ color: '#E0B15C', metalness: 0.9, roughness: 0.25, transparent: true }),
      pink: new MeshStandardMaterial({ color: '#FF8FAB', roughness: 0.5, transparent: true }),
      glow: new MeshStandardMaterial({ color: a.color, emissive: a.color, emissiveIntensity: 2.2, transparent: true, toneMapped: false }),
      blush: new MeshStandardMaterial({ color: '#FF8FA0', roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false }),
      shoe: new MeshStandardMaterial({ color: '#0f131c', roughness: 0.35, metalness: 0.1, transparent: true }),
      pants: new MeshStandardMaterial({ color: '#232a3a', roughness: 0.7, transparent: true }),
      visor: new MeshStandardMaterial({ color: '#141a2a', roughness: 0.12, metalness: 0.35, transparent: true }),
    }),
    [a.color, a.skin, a.hairColor],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  return mats
}

type Mats = ReturnType<typeof useMaterials>

/**
 * Модель персонажа из Blender: public/models/avatar.glb (исходник — assets-src/roundtable-props.blend).
 * Каждая часть — отдельный узел P_<имя>, начало координат у неё в суставе (плечо, бедро, колено, центр головы),
 * поэтому её можно просто положить в нужную «кость» рига. Материалы Av* перекрашиваются под внешность.
 */
const AVATAR_GLB = `${import.meta.env.BASE_URL}models/avatar.glb`
useGLTF.preload(AVATAR_GLB)

const MAT_KEY: Record<string, keyof Mats> = {
  AvBody: 'body', AvSkin: 'skin', AvHair: 'hair', AvDark: 'dark', AvWhite: 'white', AvMetal: 'metal',
  AvPink: 'pink', AvGlow: 'glow', AvBlush: 'blush', AvShoe: 'shoe', AvPants: 'pants', AvVisor: 'visor',
}

/** Геометрия и имя материала каждого куска части (часть = 1 или несколько примитивов glTF) */
function usePart(name: string): { geometry: BufferGeometry; mat: keyof Mats }[] {
  const { scene } = useGLTF(AVATAR_GLB)
  return useMemo(() => {
    const node = scene.getObjectByName(`P_${name}`)
    const out: { geometry: BufferGeometry; mat: keyof Mats }[] = []
    node?.traverse((o) => {
      if (o instanceof Mesh) out.push({ geometry: o.geometry, mat: MAT_KEY[(o.material as Material).name] ?? 'body' })
    })
    return out
  }, [scene, name])
}

function Part({ name, mats, y = 0 }: { name: string; mats: Mats; y?: number }) {
  const pieces = usePart(name)
  return (
    <group position-y={y}>
      {pieces.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={mats[p.mat]} castShadow={p.mat !== 'blush'} />
      ))}
    </group>
  )
}

/** Голова, причёска и аксессуар. Аксессуары сделаны под голову «Человек» (верх на 0.2). */
function HeadParts({ a, mats }: { a: Appearance; mats: Mats }) {
  const human = a.style === 'classic'
  const top = a.style === 'robot' ? 0.16 : human && (a.hair === 'mohawk' || a.hair === 'curly') ? 0.24 : 0.2
  const accessory = a.style === 'round' && a.accessory === 'glasses' ? 'none' : a.accessory
  // Очки на роботе сидят чуть ближе: его «лицо» — плоская панель
  const accY = accessory === 'glasses' ? 0 : top - 0.2
  return (
    <>
      <Part name={`head_${a.style}`} mats={mats} />
      {human && a.hair !== 'none' && accessory !== 'cap' && <Part name={`hair_${a.hair}`} mats={mats} />}
      {a.style === 'robot' && accessory === 'none' && <Part name="robot_antenna" mats={mats} />}
      {accessory !== 'none' && <Part name={`acc_${accessory}`} mats={mats} y={accY} />}
    </>
  )
}

/** Геометрия персонажа. Начало координат — на полу, лицо смотрит по +Z. */
function Body({ a, mats, rig, children }: { a: Appearance; mats: Mats; rig: React.RefObject<Partial<Rig>>; children?: React.ReactNode }) {
  const bind = (k: keyof Rig) => (g: Group | null) => {
    if (g) rig.current[k] = g
  }
  return (
    <group ref={bind('pelvis')} position-y={PELVIS_STAND}>
      <group ref={bind('torso')}>
        <Suspense fallback={null}>
          <Part name={`torso_${a.outfit}`} mats={mats} />
          {a.style === 'classic' && <Part name="neck" mats={mats} />}
        </Suspense>
        <group ref={bind('head')} position-y={0.8}>
          <Suspense fallback={null}>
            <HeadParts a={a} mats={mats} />
          </Suspense>
        </group>
        {(['L', 'R'] as const).map((s) => (
          <group key={s} ref={bind(`sh${s}`)} position={[s === 'L' ? -0.27 : 0.27, 0.55, 0]}>
            <Suspense fallback={null}>
              <Part name="arm" mats={mats} />
            </Suspense>
          </group>
        ))}
      </group>
      {(['L', 'R'] as const).map((s) => (
        <group key={s} ref={bind(`hip${s}`)} position={[s === 'L' ? -0.1 : 0.1, 0, 0]}>
          <Suspense fallback={null}>
            <Part name="thigh" mats={mats} />
          </Suspense>
          <group ref={bind(`knee${s}`)} position-y={-0.45}>
            <Suspense fallback={null}>
              <Part name="shin" mats={mats} />
            </Suspense>
          </group>
        </group>
      ))}
      {children}
    </group>
  )
}

interface PoseInput {
  t: number
  seed: number
  sit: number // 0 стоит … 1 сидит
  walk: number // амплитуда шага
  cycle: number // фаза шага
  hand: number // 0…1 поднятая правая рука
  level: number // громкость голоса
}

function applyPose(r: Partial<Rig>, p: PoseInput) {
  if (!r.pelvis || !r.torso || !r.head || !r.shL || !r.shR || !r.hipL || !r.hipR || !r.kneeL || !r.kneeR) return
  const swing = Math.sin(p.cycle) * 0.55 * p.walk
  r.pelvis.position.y = MathUtils.lerp(PELVIS_STAND, PELVIS_SIT, p.sit) + Math.abs(Math.sin(p.cycle)) * 0.03 * p.walk

  r.hipL.rotation.x = MathUtils.lerp(swing, -Math.PI / 2, p.sit)
  r.hipR.rotation.x = MathUtils.lerp(-swing, -Math.PI / 2, p.sit)
  r.kneeL.rotation.x = MathUtils.lerp(Math.max(0, -Math.sin(p.cycle)) * 0.7 * p.walk, Math.PI / 2, p.sit)
  r.kneeR.rotation.x = MathUtils.lerp(Math.max(0, Math.sin(p.cycle)) * 0.7 * p.walk, Math.PI / 2, p.sit)

  // Idle-покачивание
  const breathe = Math.sin(p.t * 1.3 + p.seed)
  r.torso.rotation.z = Math.sin(p.t * 0.9 + p.seed) * 0.035
  r.torso.rotation.x = 0.06 * p.sit + breathe * 0.015
  r.head.rotation.y = Math.sin(p.t * 0.45 + p.seed * 2) * 0.3
  r.head.rotation.x = Math.sin(p.t * 9) * 0.06 * p.level

  // Руки: при ходьбе — в противофазе к ногам, сидя — на столе
  const restArm = MathUtils.lerp(-swing * 0.8, -1.05 + breathe * 0.03, p.sit)
  r.shL.rotation.x = restArm
  r.shL.rotation.z = MathUtils.lerp(-0.08, 0.12, p.sit)
  r.shR.rotation.x = MathUtils.lerp(MathUtils.lerp(swing * 0.8, -1.05 - breathe * 0.03, p.sit), -2.85, p.hand)
  r.shR.rotation.z = MathUtils.lerp(MathUtils.lerp(0.08, -0.12, p.sit), Math.sin(p.t * 7) * 0.22, p.hand)
}

export function Avatar({ p, isSelf, showLabel = true, badge }: { p: Participant; isSelf: boolean; showLabel?: boolean; badge?: string }) {
  const root = useRef<Group>(null!)
  const rig = useRef<Partial<Rig>>({})
  const label = useRef<HTMLDivElement>(null)
  const mats = useMaterials(p)
  const markSeated = useRoom((s) => s.markSeated)

  const seed = useMemo(() => hashSeed(p.id), [p.id])
  const path = useMemo(() => buildEntryPath(p.seat), [p.seat])
  const len = useMemo(() => pathLength(path), [path])
  const seatV = useMemo(() => new Vector3(...seatPosition(p.seat)), [p.seat])
  const frontV = useMemo(() => new Vector3(...seatPosition(p.seat, FRONT_RADIUS)), [p.seat])
  const seatRot = seatRotationY(p.seat)

  const st = useRef({
    phase: (p.status === 'seated' ? 'seated' : 'walk') as Phase,
    t: 0,
    dist: 0,
    opacity: p.status === 'seated' ? 1 : 0,
    heading: p.status === 'seated' ? seatRot : -Math.PI / 2,
    cycle: 0,
    walk: 0,
    hand: 0,
    level: 0,
    pos: new Vector3(),
  })

  useFrame(({ clock }, dt) => {
    const s = st.current
    const g = root.current
    if (!g || s.phase === 'gone') return
    dt = Math.min(dt, 0.05)
    s.t += dt

    if (p.status === 'leaving' && (s.phase === 'seated' || s.phase === 'sit')) {
      s.phase = 'stand'
      s.t = 0
    } else if (p.status === 'leaving' && s.phase === 'walk') {
      s.phase = 'fade'
    }

    let sit = 0
    let walking = false
    let targetHeading = s.heading

    switch (s.phase) {
      case 'walk': {
        s.dist += WALK_SPEED * dt
        targetHeading = samplePath(path, s.dist, s.pos)
        s.opacity = Math.min(1, s.opacity + dt / FADE_TIME)
        walking = true
        if (s.dist >= len) {
          s.phase = 'sit'
          s.t = 0
        }
        break
      }
      case 'sit': {
        const k = ease(Math.min(1, s.t / SIT_TIME))
        s.pos.lerpVectors(frontV, seatV, k)
        sit = k
        targetHeading = seatRot
        if (s.t >= SIT_TIME) {
          s.phase = 'seated'
          markSeated(p.id)
        }
        break
      }
      case 'seated':
        s.pos.copy(seatV)
        sit = 1
        targetHeading = seatRot
        break
      case 'stand': {
        const k = ease(Math.min(1, s.t / SIT_TIME))
        s.pos.lerpVectors(seatV, frontV, k)
        sit = 1 - k
        if (s.t >= SIT_TIME) s.phase = 'fade'
        break
      }
      case 'fade':
        s.opacity -= dt / FADE_TIME
        if (s.opacity <= 0) {
          s.opacity = 0
          s.phase = 'gone'
          g.visible = false
          return
        }
        break
    }

    s.heading = angleLerp(s.heading, targetHeading, Math.min(1, dt * (walking ? 8 : 6)))
    s.walk = MathUtils.damp(s.walk, walking ? 1 : 0, 8, dt)
    s.cycle += dt * WALK_SPEED * 4.2 * s.walk
    s.hand = MathUtils.damp(s.hand, p.handRaised ? 1 : 0, 6, dt)
    s.level = MathUtils.damp(s.level, participantLevel(p, clock.elapsedTime), 12, dt)

    g.position.set(s.pos.x, 0, s.pos.z)
    g.rotation.y = s.heading
    const scale = 0.85 + 0.15 * s.opacity
    g.scale.setScalar(scale)
    for (const m of Object.values(mats)) m.opacity = s.opacity
    mats.blush.opacity = s.opacity * 0.55
    if (label.current) label.current.style.opacity = String(s.opacity)

    applyPose(rig.current, { t: clock.elapsedTime, seed, sit, walk: s.walk, cycle: s.cycle, hand: s.hand, level: s.level })
  })

  return (
    <group ref={root}>
      <Body a={p} mats={mats} rig={rig}>
        {showLabel && (
          <Html ref={label} position={[0, 1.32, 0]} center distanceFactor={isSelf ? 4.5 : 8} zIndexRange={[20, 0]} className="pointer-events-none select-none">
            <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink/75 px-3 py-1 text-[13px] font-semibold text-paper ring-1 ring-white/15 backdrop-blur">
              <span className="size-2 rounded-full" style={{ background: p.color }} />
              {p.name}
              {p.isHost && <Crown className="size-3.5 text-brass" aria-label="Главный" />}
              {isSelf && <span className="text-fog font-medium">· вы</span>}
              {p.handRaised && <Hand className="size-3.5 text-brass" aria-label="Рука поднята" />}
              {!p.micOn && <MicOff className="size-3.5 text-fog" aria-label="Микрофон выключен" />}
              {badge && <span className="ml-0.5 rounded-full bg-white/12 px-2 py-0.5 text-[11px] font-bold">{badge}</span>}
            </div>
          </Html>
        )}
      </Body>
    </group>
  )
}

/** Аватар на превью (экран входа): стоит и покачивается */
export function AvatarPreview({ a }: { a: Appearance }) {
  const rig = useRef<Partial<Rig>>({})
  const g = useRef<Group>(null!)
  const mats = useMaterials(a)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    g.current.rotation.y = Math.sin(t * 0.5) * 0.5
    applyPose(rig.current, { t, seed: 1, sit: 0, walk: 0, cycle: 0, hand: MathUtils.smoothstep(Math.sin(t * 0.7), 0.4, 0.9), level: 0 })
  })
  return (
    <group ref={g}>
      <Body a={a} mats={mats} rig={rig} />
    </group>
  )
}
