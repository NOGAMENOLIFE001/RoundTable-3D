import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Color, Mesh, MeshStandardMaterial, type Object3D } from 'three'
import { glow } from './Furniture'

/**
 * Модели из Blender (исходник: assets-src/roundtable-props.blend, экспорт в public/models/*.glb).
 * Начало координат у каждой — центр на полу, «лицо» смотрит по +Z.
 * Материалы названы в Blender: Fabric, Frame, Accent, LampGlow и т. д. — по имени их и перекрашиваем.
 */
const url = (name: string) => `${import.meta.env.BASE_URL}models/${name}.glb`
const CHAIR = url('chair')
const PLANT = url('plant')
const SOFA = url('sofa')
const LAMP = url('lamp')

/** Клон модели со своими материалами (чтобы перекраска одного экземпляра не меняла остальные) */
function useInstance(path: string, tint: (name: string, m: MeshStandardMaterial) => void, deps: unknown[]) {
  const { scene } = useGLTF(path)
  return useMemo(() => {
    const root = scene.clone(true)
    root.traverse((o: Object3D) => {
      if (!(o instanceof Mesh)) return
      o.castShadow = true
      o.receiveShadow = true
      const m = (o.material as MeshStandardMaterial).clone()
      tint(m.name, m)
      o.material = m
    })
    return root
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, ...deps])
}

const BRASS = '#E0B15C'

/** Эргономичное кресло. main — главное место (латунь и тёплая ткань), accent — цвет неоновой полосы */
export function ChairModel({ main, accent }: { main: boolean; accent?: string }) {
  const obj = useInstance(
    CHAIR,
    (name, m) => {
      if (name === 'Fabric' && main) m.color.set('#3a3326')
      if (name === 'Frame' && main) m.color.set(BRASS)
      if (name === 'Accent') {
        const c = accent ?? (main ? BRASS : '#5EF2C7')
        m.color = glow(c, accent ? 2.4 : 1.4)
        m.emissive = new Color(c)
        m.emissiveIntensity = accent ? 1.6 : 0.6
        m.toneMapped = false
      }
    },
    [main, accent],
  )
  return <primitive object={obj} />
}

export function PlantModel() {
  const obj = useInstance(PLANT, () => {}, [])
  return <primitive object={obj} />
}

export function SofaModel() {
  const obj = useInstance(SOFA, () => {}, [])
  return <primitive object={obj} />
}

/** Торшер-дуга; лампа светится и даёт тёплый свет вокруг */
export function LampModel({ light = true }: { light?: boolean }) {
  const obj = useInstance(
    LAMP,
    (name, m) => {
      if (name === 'LampGlow') {
        m.color = glow('#ffd59a', 2.2)
        m.emissive = new Color('#ffd59a')
        m.emissiveIntensity = 2
        m.toneMapped = false
      }
    },
    [],
  )
  return (
    <group>
      <primitive object={obj} />
      {/* Абажур висит в 1.25 м от основания по +X, на высоте ~1.5 м */}
      {light && <pointLight position={[1.25, 1.45, 0]} intensity={2.2} distance={4.5} decay={2} color="#ffd59a" />}
    </group>
  )
}

for (const u of [CHAIR, PLANT, SOFA, LAMP]) useGLTF.preload(u)
