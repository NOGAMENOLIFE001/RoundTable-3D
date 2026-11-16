import { useState } from 'react'
import { UserRoundPen } from 'lucide-react'
import { CharacterModal } from '../hud/CharacterModal'
import { useApp } from '../store/useAppStore'
import { useRoom } from '../store/useRoomStore'
import { isValidCode, normalizeCode } from '../lib/misc'
import { Brand } from './Brand'
import { useEntrance } from '../lib/motion'

/** Код из ссылки-приглашения вида ?room=ABC234 */
const codeFromUrl = () => normalizeCode(new URLSearchParams(location.search).get('room') ?? '')

export function LobbyScreen() {
  const profile = useApp((s) => s.profile)!
  const logout = useApp((s) => s.logout)
  const createRoom = useRoom((s) => s.createRoom)
  const joinRoom = useRoom((s) => s.joinRoom)

  const [topic, setTopic] = useState('')
  const [code, setCode] = useState(codeFromUrl)
  const [error, setError] = useState('')
  const [createError, setCreateError] = useState('')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [editing, setEditing] = useState(false)
  const scope = useEntrance<HTMLElement>()
  const account = useApp((s) => s.account)
  const notice = useApp((s) => s.notice)
  const setNotice = useApp((s) => s.setNotice)

  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidCode(code)) return setError('Код состоит из 6 латинских букв и цифр, например K7MP2Q.')
    setBusy('join')
    setNotice(null)
    const err = await joinRoom(profile, code)
    setBusy(null)
    if (err) setError(err)
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('create')
    setNotice(null)
    setCreateError('')
    const err = await createRoom(profile, topic)
    setBusy(null)
    if (err) setCreateError(err)
  }

  return (
    <main ref={scope} className="mx-auto flex min-h-full max-w-6xl flex-col justify-center px-4 py-10 sm:px-8">
      <div data-enter className="flex max-w-md items-center justify-between">
        <Brand />
        <button onClick={() => void logout()} className="text-sm text-fog underline-offset-4 hover:text-paper hover:underline">
          Выйти
        </button>
      </div>

      <h1 data-enter className="mt-10 max-w-md font-display text-3xl leading-tight font-bold text-balance sm:text-[2.6rem]">
        <span aria-hidden className="mr-2 inline-block size-[0.42em] -translate-y-[0.12em] rounded-full align-middle" style={{ background: profile.color, boxShadow: `0 0 0.5em ${profile.color}` }} />
        {profile.name}, куда садимся?
      </h1>
      <div data-enter className="mt-3 flex max-w-md flex-wrap items-center gap-3 text-sm text-fog">
        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-xl bg-white/8 px-3 py-2 font-semibold text-paper hover:bg-white/15">
          <UserRoundPen className="size-4" /> Изменить персонажа
        </button>
        <span>{account?.email ?? (account?.provider === 'guest' ? 'Гостевой вход' : account ? 'Аккаунт Google' : 'Гость на этом устройстве')}</span>
      </div>
      {editing && <CharacterModal onClose={() => setEditing(false)} />}

      {notice && (
        <p role="alert" className="mt-6 max-w-md rounded-2xl bg-alarm/15 px-4 py-3 text-sm ring-1 ring-alarm/40">
          {notice}
        </p>
      )}

      <div className="mt-8 w-full max-w-md space-y-3">
        <form data-enter onSubmit={create} className="glass rounded-3xl p-5 sm:p-6" aria-busy={busy === 'create'}>
          <h2 className="font-display text-lg font-bold">Новая комната</h2>
          <p className="mt-1 text-sm text-fog">Вы займёте главное место, остальные подключатся по коду.</p>
          <label htmlFor="topic" className="mt-4 block text-sm font-semibold">Тема дискуссии</label>
          <input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={80}
            placeholder="Например, план релиза на декабрь"
            className="mt-2 w-full rounded-xl bg-ink/70 px-3.5 py-2.5 ring-1 ring-white/12 placeholder:text-fog/60 focus:ring-mint focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy !== null}
            className="mt-4 w-full rounded-xl bg-mint py-3 font-bold text-ink transition hover:brightness-110 disabled:opacity-60"
          >
            {busy === 'create' ? 'Создаём комнату…' : 'Создать комнату'}
          </button>
          {createError && <p role="alert" className="mt-2 text-sm text-alarm">{createError}</p>}
        </form>

        <form data-enter onSubmit={join} className="glass rounded-3xl p-5 sm:p-6" noValidate aria-busy={busy === 'join'}>
          <h2 className="font-display text-lg font-bold">Войти по коду</h2>
          <label htmlFor="code" className="sr-only">Код комнаты</label>
          <div className="mt-3 flex gap-2">
            <input
              id="code"
              value={code}
              onChange={(e) => {
                setCode(normalizeCode(e.target.value))
                setError('')
              }}
              inputMode="text"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="K7MP2Q"
              aria-invalid={!!error}
              aria-describedby={error ? 'code-error' : undefined}
              className="min-w-0 flex-1 rounded-xl bg-ink/70 px-3.5 py-2.5 text-center font-display text-lg tracking-[0.3em] ring-1 ring-white/12 placeholder:text-fog/40 focus:ring-mint focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy !== null}
              className="rounded-xl bg-paper px-5 font-bold text-ink transition hover:bg-white disabled:opacity-60"
            >
              {busy === 'join' ? 'Входим…' : 'Войти'}
            </button>
          </div>
          {error && <p id="code-error" className="mt-2 text-sm text-alarm">{error}</p>}
        </form>
      </div>
    </main>
  )
}
