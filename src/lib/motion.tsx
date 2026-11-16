import { useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

/** Плавный выезд с экспоненциальным замедлением; при «уменьшить движение» — только короткое проявление */
const EASE = 'expo.out'
const FULL = '(prefers-reduced-motion: no-preference)'
const REDUCED = '(prefers-reduced-motion: reduce)'

/** Страховка: если браузер не крутит кадры (фоновая вкладка, WebView), через 1,5 с показываем всё сразу */
function settle(tween: gsap.core.Tween) {
  const id = setTimeout(() => tween.progress(1), 1500)
  return () => clearTimeout(id)
}

/**
 * Каскадное появление: элементы с [data-enter] внутри ref выезжают по очереди.
 * Содержимое видно и без JS — GSAP только задаёт стартовую точку анимации.
 */
export function useEntrance<T extends HTMLElement>(deps: unknown[] = []) {
  const scope = useRef<T>(null)
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(FULL, () => {
        const tw = gsap.from('[data-enter]', {
          y: 18,
          autoAlpha: 0,
          filter: 'blur(6px)',
          duration: 0.9,
          ease: EASE,
          stagger: 0.07,
          clearProps: 'filter,transform',
        })
        return settle(tw)
      })
      mm.add(REDUCED, () => settle(gsap.from('[data-enter]', { autoAlpha: 0, duration: 0.25, stagger: 0.03 })))
    },
    { scope, dependencies: deps },
  )
  return scope
}

type From = 'left' | 'right' | 'top' | 'bottom' | 'scale'
const OFFSET: Record<From, gsap.TweenVars> = {
  left: { x: -24 },
  right: { x: 24 },
  top: { y: -16 },
  bottom: { y: 16 },
  scale: { scale: 0.96, y: 8 },
}

/**
 * Обёртка: панель или меню появляется с нужной стороны при монтировании.
 * Сама обёртка — display: contents, анимируется её первый элемент, так что раскладка не меняется.
 */
export function Appear({ from, delay = 0, children }: { from: From; delay?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      const el = ref.current?.firstElementChild
      if (!el) return
      mm.add(FULL, () => settle(gsap.from(el, { ...OFFSET[from], autoAlpha: 0, duration: 0.6, delay, ease: EASE, clearProps: 'transform' })))
      mm.add(REDUCED, () => settle(gsap.from(el, { autoAlpha: 0, duration: 0.2, delay })))
    },
    { scope: ref },
  )
  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  )
}
