import { useEffect, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
import { useRoom } from '../store/useRoomStore'

const time = (ts: number) => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

function Chat() {
  const messages = useRoom((s) => s.messages)
  const selfId = useRoom((s) => s.selfId)
  const send = useRoom((s) => s.sendMessage)
  const [text, setText] = useState('')
  const list = useRef<HTMLOListElement>(null)

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ol ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {messages.map((m) =>
          m.system ? (
            <li key={m.id} className="text-center text-xs text-fog/80">{m.text}</li>
          ) : (
            <li key={m.id}>
              <div className="flex items-baseline gap-2 text-xs">
                <span className="font-bold" style={{ color: m.color }}>{m.authorId === selfId ? 'Вы' : m.authorName}</span>
                <span className="text-fog/60">{time(m.ts)}</span>
              </div>
              <p className="mt-0.5 text-sm break-words">{m.text}</p>
            </li>
          ),
        )}
      </ol>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(text)
          setText('')
        }}
        className="flex gap-2 border-t border-white/10 p-3"
      >
        <label htmlFor="chat-input" className="sr-only">Сообщение</label>
        <input
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Написать всем за столом"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl bg-ink/70 px-3 py-2 text-sm ring-1 ring-white/12 placeholder:text-fog/60 focus:ring-mint focus:outline-none"
        />
        <button type="submit" disabled={!text.trim()} className="rounded-xl bg-mint px-3 text-ink transition disabled:opacity-40" aria-label="Отправить">
          <Send className="size-4" />
        </button>
      </form>
    </div>
  )
}

/** Чат комнаты (участники — в списке слева) */
export function SidePanel({ onClose }: { onClose: () => void }) {
  return (
    <aside className="glass pointer-events-auto absolute inset-x-0 top-3 bottom-0 flex flex-col overflow-hidden rounded-3xl sm:static sm:w-[340px]" aria-label="Чат">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <h2 className="text-sm font-semibold">Чат</h2>
        <button onClick={onClose} className="rounded-xl p-1.5 text-fog hover:bg-white/10 hover:text-paper" aria-label="Закрыть чат">
          <X className="size-4" />
        </button>
      </div>
      <Chat />
    </aside>
  )
}
