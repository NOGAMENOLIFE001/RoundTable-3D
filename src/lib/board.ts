import type { Stroke } from '../types'

/**
 * Доска: список штрихов + общий холст 1600×900, на который они нарисованы.
 * Этот же холст показывается текстурой на 3D-экране и в полноэкранном режиме.
 */
export const BOARD_W = 1600
export const BOARD_H = 900
export const BOARD_BG = '#101a2c'

let strokes: Stroke[] = []
const listeners = new Set<() => void>()
let canvas: HTMLCanvasElement | null = null
let version = 0

export function boardCanvas() {
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.width = BOARD_W
    canvas.height = BOARD_H
    redraw()
  }
  return canvas
}

export const boardVersion = () => version

export function onBoardChange(fn: () => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

function notify() {
  version++
  listeners.forEach((fn) => fn())
}

/** Нарисовать штрих (или его кусок) на контексте; точки нормированы 0…1 */
export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, from = 0, w = BOARD_W, h = BOARD_H) {
  const p = s.points
  if (p.length < 2) return
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = s.erase ? BOARD_BG : s.color
  ctx.lineWidth = s.width * (w / BOARD_W) * (s.erase ? 4 : 1)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  const start = Math.max(0, from - 2)
  ctx.moveTo(p[start] * w, p[start + 1] * h)
  if (p.length - start === 2) ctx.lineTo(p[start] * w + 0.1, p[start + 1] * h)
  for (let i = start + 2; i < p.length; i += 2) ctx.lineTo(p[i] * w, p[i + 1] * h)
  ctx.stroke()
  ctx.restore()
}

function redraw() {
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = BOARD_BG
  ctx.fillRect(0, 0, BOARD_W, BOARD_H)
  // Лёгкая сетка — чтобы было понятно, что это доска
  ctx.strokeStyle = 'rgba(169,182,204,0.07)'
  ctx.lineWidth = 1
  for (let x = 0; x < BOARD_W; x += 50) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, BOARD_H)
    ctx.stroke()
  }
  for (let y = 0; y < BOARD_H; y += 50) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(BOARD_W, y)
    ctx.stroke()
  }
  for (const s of strokes) drawStroke(ctx, s)
}

export function setStrokes(list: Stroke[]) {
  strokes = list.map((s) => ({ ...s, points: [...s.points] }))
  redraw()
  notify()
}

/** Добавить штрих или дописать точки к существующему */
export function applyStroke(s: Stroke) {
  const existing = strokes.find((x) => x.id === s.id)
  let from = 0
  let target = s
  if (existing) {
    from = existing.points.length
    existing.points.push(...s.points)
    target = existing
  } else {
    strokes.push({ ...s, points: [...s.points] })
    target = strokes[strokes.length - 1]
  }
  if (canvas) drawStroke(canvas.getContext('2d')!, target, from)
  notify()
}

export function removeStroke(id: string) {
  strokes = strokes.filter((s) => s.id !== id)
  redraw()
  notify()
}

export function clearBoard() {
  strokes = []
  redraw()
  notify()
}
