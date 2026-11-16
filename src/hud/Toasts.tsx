import { useRoom } from '../store/useRoomStore'

export function Toasts() {
  const toasts = useRoom((s) => s.toasts)
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-40 flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="glass rounded-full px-4 py-2 text-sm font-semibold shadow-lg">
          {t.text}
        </div>
      ))}
    </div>
  )
}
