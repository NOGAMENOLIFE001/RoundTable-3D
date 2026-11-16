import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useApp, type Look } from '../store/useAppStore'
import { useRoom } from '../store/useRoomStore'
import { CharacterEditor } from './CharacterEditor'

/** Окно редактирования персонажа — из лобби и прямо за столом */
export function CharacterModal({ onClose }: { onClose: () => void }) {
  const profile = useApp((s) => s.profile)!
  const updateLook = useApp((s) => s.updateLook)
  const updateProfile = useRoom((s) => s.updateProfile)
  const { id: _id, ...initial } = profile
  const [look, setLook] = useState<Look>(initial)
  const [error, setError] = useState('')

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const save = () => {
    if (look.name.trim().length < 2) return setError('Имя — минимум 2 символа')
    const next = { ...look, name: look.name.trim() }
    updateLook(next)
    updateProfile(next)
    onClose()
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-3 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="char-title"
        className="glass max-h-full w-full max-w-xl overflow-y-auto rounded-3xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="char-title" className="font-display text-lg font-bold">Ваш персонаж</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-fog hover:bg-white/10 hover:text-paper" aria-label="Закрыть">
            <X className="size-5" />
          </button>
        </div>
        <CharacterEditor value={look} onChange={(v) => { setLook(v); setError('') }} nameError={error} />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-fog hover:text-paper">Отмена</button>
          <button onClick={save} className="rounded-xl bg-mint px-5 py-2.5 text-sm font-bold text-ink hover:brightness-110">Сохранить</button>
        </div>
      </div>
    </div>
  )
}
