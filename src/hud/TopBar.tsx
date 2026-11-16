import { useEffect, useState } from 'react'
import { Check, Link2, MessageSquare, Pencil, UserRoundPen, Users } from 'lucide-react'
import { useRoom } from '../store/useRoomStore'
import { SEAT_COUNT } from '../lib/seats'
import { Brand } from '../screens/Brand'

function TopicEditor() {
  const topic = useRoom((s) => s.topic)
  const setTopic = useRoom((s) => s.setTopic)
  const isHost = useRoom((s) => s.participants.find((p) => p.id === s.selfId)?.isHost ?? false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(topic)
  useEffect(() => setDraft(topic), [topic])

  if (!isHost) return <p className="truncate font-semibold" title={topic}>{topic}</p>

  if (editing) {
    const save = () => {
      setTopic(draft)
      setEditing(false)
    }
    return (
      <input
        autoFocus
        value={draft}
        maxLength={80}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') {
            setDraft(topic)
            setEditing(false)
          }
        }}
        aria-label="Тема дискуссии"
        className="w-full min-w-0 rounded-lg bg-ink/70 px-2 py-1 font-semibold ring-1 ring-mint focus:outline-none"
      />
    )
  }
  return (
    <button onClick={() => setEditing(true)} className="group flex min-w-0 items-center gap-2 text-left" title="Изменить тему">
      <span className="truncate font-semibold">{topic}</span>
      <Pencil className="size-3.5 shrink-0 text-fog group-hover:text-mint" aria-label="Изменить тему" />
    </button>
  )
}

export function TopBar({ chatOpen, onToggleChat, onEditCharacter }: { chatOpen: boolean; onToggleChat: () => void; onEditCharacter: () => void }) {
  const code = useRoom((s) => s.code)
  const count = useRoom((s) => s.participants.filter((p) => p.status !== 'leaving').length)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!code) return
    const url = `${location.origin}${location.pathname}?room=${code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      prompt('Скопируйте ссылку на комнату:', url)
    }
  }

  return (
    <header className="glass pointer-events-auto flex items-center gap-3 rounded-2xl px-3 py-2 sm:gap-4 sm:px-4">
      <div className="hidden md:block"><Brand compact /></div>
      <div className="flex items-center gap-1 rounded-xl bg-ink/60 py-1 pr-1 pl-3">
        <span className="font-display text-sm tracking-[0.2em]" aria-label={`Код комнаты ${code}`}>{code}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-fog transition hover:bg-white/10 hover:text-paper"
        >
          {copied ? <Check className="size-3.5 text-mint" /> : <Link2 className="size-3.5" />}
          <span className="hidden sm:inline">{copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}</span>
        </button>
      </div>
      <div className="min-w-0 flex-1"><TopicEditor /></div>
      <div className="flex items-center gap-1.5 text-sm text-fog" title="Участники за столом">
        <Users className="size-4" />
        <span className="tabular-nums"><b className="text-paper">{count}</b>/{SEAT_COUNT}</span>
      </div>
      <button
        onClick={onEditCharacter}
        className="rounded-lg p-2 text-fog transition hover:bg-white/10 hover:text-paper"
        aria-label="Изменить персонажа"
        title="Изменить персонажа"
      >
        <UserRoundPen className="size-5" />
      </button>
      <button
        onClick={onToggleChat}
        className={`rounded-lg p-2 transition hover:bg-white/10 ${chatOpen ? 'text-mint' : 'text-fog hover:text-paper'}`}
        aria-label={chatOpen ? 'Скрыть чат' : 'Показать чат'}
        aria-expanded={chatOpen}
        title="Чат"
      >
        <MessageSquare className="size-5" />
      </button>
    </header>
  )
}
