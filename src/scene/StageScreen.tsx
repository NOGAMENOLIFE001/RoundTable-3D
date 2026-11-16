import { useEffect, useState } from 'react'
import { CanvasTexture, SRGBColorSpace, TextureLoader, VideoTexture, type Texture } from 'three'
import { useRoom } from '../store/useRoomStore'
import { boardCanvas, onBoardChange } from '../lib/board'

/** Большой экран на задней стене: доска, слайд или демонстрация экрана */
const MAX_W = 6.2
const MAX_H = 3.5
const CENTER: [number, number, number] = [0, 2.55, -9.6]

function useBoardTexture(active: boolean) {
  const [tex, setTex] = useState<CanvasTexture | null>(null)
  useEffect(() => {
    if (!active) return
    const t = new CanvasTexture(boardCanvas())
    t.colorSpace = SRGBColorSpace
    setTex(t)
    const off = onBoardChange(() => {
      t.needsUpdate = true
    })
    return () => {
      off()
      t.dispose()
      setTex(null)
    }
  }, [active])
  return tex
}

function useImageTexture(url: string | null) {
  const [tex, setTex] = useState<Texture | null>(null)
  useEffect(() => {
    if (!url) return
    let alive = true
    let loaded: Texture | null = null
    new TextureLoader().load(url, (t) => {
      t.colorSpace = SRGBColorSpace
      loaded = t
      if (alive) setTex(t)
      else t.dispose()
    })
    return () => {
      alive = false
      loaded?.dispose()
      setTex(null)
    }
  }, [url])
  return tex
}

function useVideoTexture(stream: MediaStream | null) {
  const [tex, setTex] = useState<VideoTexture | null>(null)
  useEffect(() => {
    if (!stream) return
    // Видео создаём в эффекте: StrictMode не оставит нас с остановленным <video>
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    void video.play().catch(() => {})
    const t = new VideoTexture(video)
    t.colorSpace = SRGBColorSpace
    setTex(t)
    return () => {
      video.pause()
      video.srcObject = null
      t.dispose()
      setTex(null)
    }
  }, [stream])
  return tex
}

/** Размер картинки, вписанный в рамку экрана */
function fitSize(tex: Texture | null): [number, number] {
  const img = tex?.image as { width?: number; height?: number; videoWidth?: number; videoHeight?: number } | undefined
  const w = img?.videoWidth || img?.width || 16
  const h = img?.videoHeight || img?.height || 9
  const k = Math.min(MAX_W / w, MAX_H / h)
  return [w * k, h * k]
}

export function StageScreen() {
  const stage = useRoom((s) => s.stage)
  const selfId = useRoom((s) => s.selfId)
  const screenStream = useRoom((s) => s.screenStream)
  const remoteScreens = useRoom((s) => s.remoteScreens)
  const setPanel = useRoom((s) => s.setPanel)

  const presenterStream =
    stage.mode === 'screen' && stage.presenterId
      ? stage.presenterId === selfId ? screenStream : remoteScreens[stage.presenterId] ?? null
      : null

  const board = useBoardTexture(stage.mode === 'board')
  const slide = useImageTexture(stage.mode === 'slides' ? stage.slides[stage.slide] ?? null : null)
  const video = useVideoTexture(presenterStream)
  const tex = stage.mode === 'board' ? board : stage.mode === 'slides' ? slide : stage.mode === 'screen' ? video : null

  // Размер видео известен только после загрузки метаданных — пересчитываем раз в секунду
  const [, bump] = useState(0)
  useEffect(() => {
    if (stage.mode !== 'screen') return
    const t = setInterval(() => bump((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [stage.mode])

  if (stage.mode === 'none') return null
  const [w, h] = fitSize(tex)

  return (
    <group position={CENTER}>
      {/* Рамка с неоновым кантом */}
      <mesh position-z={-0.03}>
        <planeGeometry args={[w + 0.24, h + 0.24]} />
        <meshBasicMaterial color="#5EF2C7" toneMapped={false} />
      </mesh>
      <mesh position-z={-0.02}>
        <planeGeometry args={[w + 0.16, h + 0.16]} />
        <meshBasicMaterial color="#070b14" />
      </mesh>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          setPanel('stage')
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <planeGeometry args={[w, h]} />
        {/* key: при смене текстуры материал пересоздаётся, иначе шейдер останется без карты */}
        {tex ? (
          <meshBasicMaterial key={tex.uuid} map={tex} toneMapped={false} />
        ) : (
          <meshBasicMaterial key="empty" color="#101a2c" />
        )}
      </mesh>
    </group>
  )
}
