import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type AmbientLight, type DirectionalLight, type HemisphereLight, type PointLight } from 'three'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { Environment, Lightformer } from '@react-three/drei'
import { DOOR } from '../lib/seats'
import { LampModel, PlantModel, SofaModel } from './Props'
import { glow } from './Furniture'

const MINT = '#5EF2C7'
const BRASS = '#E0B15C'

/** Ночной город за окном — рисуем один раз в canvas */
function useCityTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 384
    const g = c.getContext('2d')!
    const sky = g.createLinearGradient(0, 0, 0, c.height)
    sky.addColorStop(0, '#0a1430')
    sky.addColorStop(1, '#22305a')
    g.fillStyle = sky
    g.fillRect(0, 0, c.width, c.height)
    let x = 0
    while (x < c.width) {
      const w = 40 + Math.random() * 70
      const h = 120 + Math.random() * 220
      g.fillStyle = `hsl(222 35% ${8 + Math.random() * 6}%)`
      g.fillRect(x, c.height - h, w, h)
      for (let wy = c.height - h + 10; wy < c.height - 8; wy += 14) {
        for (let wx = x + 6; wx < x + w - 8; wx += 11) {
          if (Math.random() < 0.32) {
            g.fillStyle = Math.random() < 0.8 ? 'rgba(255,214,150,0.85)' : 'rgba(94,242,199,0.8)'
            g.fillRect(wx, wy, 5, 7)
          }
        }
      }
      x += w + 4
    }
    const tex = new CanvasTexture(c)
    tex.colorSpace = SRGBColorSpace
    return tex
  }, [])
}

function NeonStrip({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  const c = useMemo(() => glow(color, 2.4), [color])
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={c} toneMapped={false} />
    </mesh>
  )
}

/** night — ночь в мафии: свет плавно гаснет, остаётся холодный лунный и неон */
export function Loft({ night = false }: { night?: boolean }) {
  const city = useCityTexture()
  const amb = useRef<AmbientLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const sun = useRef<DirectionalLight>(null)
  const lamp = useRef<PointLight>(null)
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 2)
    if (amb.current) amb.current.intensity = MathUtils.lerp(amb.current.intensity, night ? 0.12 : 0.55, k)
    if (hemi.current) hemi.current.intensity = MathUtils.lerp(hemi.current.intensity, night ? 0.08 : 0.5, k)
    if (sun.current) sun.current.intensity = MathUtils.lerp(sun.current.intensity, night ? 0.35 : 1.6, k)
    if (lamp.current) lamp.current.intensity = MathUtils.lerp(lamp.current.intensity, night ? 2 : 18, k)
  })
  const wallMat = <meshStandardMaterial color="#1b2740" roughness={0.9} />
  const brassGlow = useMemo(() => glow(BRASS, 1.4), [])
  const lampGlow = useMemo(() => glow('#ffe2b0', 3), [])

  return (
    <group>
      <color attach="background" args={['#0b1322']} />
      <fog attach="fog" args={['#0b1322', 16, 32]} />

      {/* Отражения для металла и лака: окружение собирается из светящихся панелей прямо в сцене, без загрузки HDR */}
      <Environment resolution={128} frames={1} environmentIntensity={night ? 0.15 : 0.45}>
        <Lightformer form="ring" intensity={3} color="#ffd59a" position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={3} />
        <Lightformer form="rect" intensity={1.2} color="#7f9ae0" position={[0, 3, -9]} scale={[13, 4, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#5EF2C7" position={[-9, 4.6, 0]} rotation-y={Math.PI / 2} scale={[19, 0.3, 1]} />
      </Environment>
      <ambientLight ref={amb} intensity={0.55} color="#a9bce0" />
      <hemisphereLight ref={hemi} args={['#8fa8d8', '#1a1410', 0.5]} />
      <directionalLight
        ref={sun}
        position={[5, 11, 6]}
        intensity={1.6}
        color="#dfe8ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0004}
      />
      {/* Тёплый свет кольцевой люстры над столом */}
      <pointLight ref={lamp} position={[0, 3.3, 0]} intensity={18} distance={12} decay={2} color="#ffd59a" />

      {/* Пол: тёмный бетон + ковёр под столом */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#141c2c" roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.005} receiveShadow>
        <circleGeometry args={[4.6, 64]} />
        <meshStandardMaterial color="#232f4a" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.008}>
        <ringGeometry args={[4.55, 4.62, 96]} />
        <meshBasicMaterial color={brassGlow} toneMapped={false} />
      </mesh>

      {/* Стены */}
      <mesh position={[0, 3, -10]} receiveShadow>
        <boxGeometry args={[20, 6, 0.2]} />
        {wallMat}
      </mesh>
      <mesh position={[-10, 3, 0]} receiveShadow>
        <boxGeometry args={[0.2, 6, 20]} />
        {wallMat}
      </mesh>
      <mesh position={[10, 3, 0]} receiveShadow>
        <boxGeometry args={[0.2, 6, 20]} />
        {wallMat}
      </mesh>
      <mesh position={[0, 3, 10]} receiveShadow>
        <boxGeometry args={[20, 6, 0.2]} />
        {wallMat}
      </mesh>
      <mesh position={[0, 6, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#0f1728" />
      </mesh>

      {/* Панорамное окно на задней стене */}
      <mesh position={[0, 2.9, -9.88]}>
        <planeGeometry args={[13, 4.4]} />
        <meshBasicMaterial map={city} toneMapped={false} />
      </mesh>
      {[-6.5, -3.25, 0, 3.25, 6.5].map((x) => (
        <mesh key={x} position={[x, 2.9, -9.84]}>
          <boxGeometry args={[0.08, 4.5, 0.06]} />
          <meshStandardMaterial color="#0c1220" />
        </mesh>
      ))}

      {/* Неоновые линии */}
      <NeonStrip position={[-9.88, 4.6, 0]} size={[0.04, 0.05, 19.6]} color={MINT} />
      <NeonStrip position={[0, 4.6, 9.88]} size={[19.6, 0.05, 0.04]} color={MINT} />
      <NeonStrip position={[-9.88, 0.08, 0]} size={[0.04, 0.03, 19.6]} color={BRASS} />
      <NeonStrip position={[9.88, 0.08, 4]} size={[0.04, 0.03, 12]} color={BRASS} />

      {/* Дверь, через которую входят участники */}
      <group position={[9.88, 0, DOOR.z]}>
        <mesh position={[-0.02, 1.25, 0]}>
          <boxGeometry args={[0.04, 2.5, 1.4]} />
          <meshStandardMaterial color="#070b14" />
        </mesh>
        <NeonStrip position={[-0.05, 2.52, 0]} size={[0.03, 0.04, 1.48]} color={MINT} />
        <NeonStrip position={[-0.05, 1.26, 0.72]} size={[0.03, 2.52, 0.04]} color={MINT} />
        <NeonStrip position={[-0.05, 1.26, -0.72]} size={[0.03, 2.52, 0.04]} color={MINT} />
      </group>

      {/* Кольцевая люстра */}
      <mesh position={[0, 3.6, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.6, 0.035, 12, 96]} />
        <meshBasicMaterial color={lampGlow} toneMapped={false} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.sin(a) * 1.6, 4.8, Math.cos(a) * 1.6]}>
            <cylinderGeometry args={[0.006, 0.006, 2.4]} />
            <meshBasicMaterial color="#3a4660" />
          </mesh>
        )
      })}

      {/* Растения в кадках по углам и зона отдыха у левой стены — модели из Blender */}
      <Suspense fallback={null}>
        {[[-8.6, -8.6], [8.6, -8.6], [-8.6, 8.6], [8.6, 8.6]].map(([x, z], k) => (
          <group key={`${x}${z}`} position={[x, 0, z]} rotation-y={k * 1.3}>
            <PlantModel />
          </group>
        ))}
        {/* Диван вдоль левой стены лицом к столу и второй — под окном */}
        <group position={[-9.25, 0, 0.3]} rotation-y={Math.PI / 2}>
          <SofaModel />
        </group>
        <group position={[-5.6, 0, -9.3]}>
          <SofaModel />
        </group>
        {/* Торшеры: абажур нависает над краем дивана */}
        <group position={[-9.45, 0, 2.2]} rotation-y={0}>
          <LampModel light={!night} />
        </group>
        <group position={[-7.9, 0, -9.55]} rotation-y={-Math.PI / 2}>
          <LampModel light={!night} />
        </group>
      </Suspense>
    </group>
  )
}
