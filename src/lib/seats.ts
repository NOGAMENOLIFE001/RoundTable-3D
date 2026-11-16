import { Vector3 } from 'three'

import { SEAT_COUNT } from '../../shared/protocol'
export { SEAT_COUNT }
export const TABLE_RADIUS = 2.1
export const SEAT_RADIUS = 2.85
/** Точка перед стулом, откуда аватар садится */
export const FRONT_RADIUS = SEAT_RADIUS - 0.42
/** Кольцо обхода вокруг стульев */
const WALK_RING = 4.3
/** Дверь в правой стене */
export const DOOR = new Vector3(9.4, 0, -2.5)

/** Угол места: место 0 (главное) смотрит на камеру по +Z, дальше по часовой стрелке */
export const seatAngle = (i: number) => (i / SEAT_COUNT) * Math.PI * 2

export function seatPosition(i: number, r = SEAT_RADIUS): [number, number, number] {
  const a = seatAngle(i)
  return [Math.sin(a) * r, 0, Math.cos(a) * r]
}

/** Поворот по Y, при котором аватар/стул смотрят в центр стола */
export const seatRotationY = (i: number) => seatAngle(i) + Math.PI

export function firstFreeSeat(taken: number[]): number {
  for (let i = 0; i < SEAT_COUNT; i++) if (!taken.includes(i)) return i
  return -1
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const ringPoint = (a: number, r: number) => new Vector3(Math.sin(a) * r, 0, Math.cos(a) * r)

/**
 * Путь от двери к месту: заходим на кольцо, обходим стол по дуге,
 * проходим в щель между стульями и встаём перед своим стулом.
 */
export function buildEntryPath(seat: number): Vector3[] {
  const doorA = Math.atan2(DOOR.x, DOOR.z)
  const seatA = seatAngle(seat)
  const delta = wrap(seatA - doorA)
  const side = delta >= 0 ? 1 : -1
  const gapA = seatA - side * (Math.PI / SEAT_COUNT) // середина между соседними стульями
  const arc = wrap(gapA - doorA)

  const pts: Vector3[] = [DOOR.clone()]
  const steps = Math.max(2, Math.ceil(Math.abs(arc) / 0.12))
  for (let i = 0; i <= steps; i++) pts.push(ringPoint(doorA + (arc * i) / steps, WALK_RING))
  pts.push(ringPoint(gapA, FRONT_RADIUS + 0.05))
  pts.push(ringPoint(seatA, FRONT_RADIUS))
  return pts
}

export function pathLength(pts: Vector3[]) {
  let len = 0
  for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1])
  return len
}

/** Точка и направление на расстоянии d вдоль ломаной */
export function samplePath(pts: Vector3[], d: number, out: Vector3): number {
  for (let i = 1; i < pts.length; i++) {
    const seg = pts[i].distanceTo(pts[i - 1])
    if (d <= seg || i === pts.length - 1) {
      const k = seg === 0 ? 1 : Math.min(1, d / seg)
      out.lerpVectors(pts[i - 1], pts[i], k)
      return Math.atan2(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)
    }
    d -= seg
  }
  out.copy(pts[pts.length - 1])
  return 0
}
