/**
 * Качество 3D-сцены по устройству.
 * high — компьютер: свечение неона (bloom), мягкие тени, dpr до 2.
 * low  — телефон, планшет, слабый процессор: без постобработки, dpr до 1.5.
 * Переопределить можно параметром ?quality=high|low в адресе.
 */
export type Quality = 'high' | 'low'

export function detectQuality(): Quality {
  const forced = new URLSearchParams(location.search).get('quality')
  if (forced === 'high' || forced === 'low') return forced
  const coarse = matchMedia('(pointer: coarse)').matches
  const weakCpu = (navigator.hardwareConcurrency ?? 8) <= 4
  return coarse || weakCpu ? 'low' : 'high'
}
