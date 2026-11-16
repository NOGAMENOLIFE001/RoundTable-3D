import { MAX_SLIDES } from '../../shared/protocol'

/**
 * Файлы → слайды: картинки и страницы PDF ужимаются в JPEG ≤1600 px,
 * чтобы вся презентация уместилась в одно сообщение сокета.
 */
const MAX_SIDE = 1600
const QUALITY = 0.8

function canvasToJpeg(c: HTMLCanvasElement) {
  return c.toDataURL('image/jpeg', QUALITY)
}

function fit(w: number, h: number) {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h))
  return [Math.round(w * k), Math.round(h * k)] as const
}

async function imageToSlide(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const [w, h] = fit(bitmap.width, bitmap.height)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvasToJpeg(c)
}

async function pdfToSlides(file: File, limit: number): Promise<string[]> {
  // pdf.js тяжёлый — грузим только когда нужен
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const doc = await task.promise
  const out: string[] = []
  for (let i = 1; i <= Math.min(doc.numPages, limit); i++) {
    const page = await doc.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const scale = MAX_SIDE / Math.max(base.width, base.height)
    const viewport = page.getViewport({ scale })
    const c = document.createElement('canvas')
    c.width = Math.round(viewport.width)
    c.height = Math.round(viewport.height)
    await page.render({ canvas: c, viewport, background: '#ffffff' }).promise
    out.push(canvasToJpeg(c))
    page.cleanup()
  }
  await task.destroy()
  return out
}

export async function filesToSlides(files: File[]): Promise<string[]> {
  const out: string[] = []
  for (const f of files) {
    if (out.length >= MAX_SLIDES) break
    if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) out.push(...(await pdfToSlides(f, MAX_SLIDES - out.length)))
    else if (f.type.startsWith('image/')) out.push(await imageToSlide(f))
  }
  return out
}
