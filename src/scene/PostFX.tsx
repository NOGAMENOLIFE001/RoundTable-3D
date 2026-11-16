import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'

/** Свечение неона и мягкая виньетка. Грузится отдельным чанком и только на мощных устройствах. */
export default function PostFX({ intensity = 0.75, darkness = 0.55 }: { intensity?: number; darkness?: number }) {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={1.15} intensity={intensity} radius={0.7} />
      <Vignette offset={0.3} darkness={darkness} />
    </EffectComposer>
  )
}
