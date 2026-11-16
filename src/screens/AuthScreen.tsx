import { useState } from 'react'
import { DEFAULT_APPEARANCE } from '../../shared/protocol'
import { authErrorText, firebaseEnabled } from '../lib/auth'
import { useApp, type Look } from '../store/useAppStore'
import { CharacterEditor } from '../hud/CharacterEditor'
import { Brand } from './Brand'
import { useEntrance } from '../lib/motion'

type Mode = 'guest' | 'email'

export function AuthScreen() {
  const { enterAsGuest, enterWithEmail, enterWithGoogle } = useApp.getState()
  const [look, setLook] = useState<Look>({ ...DEFAULT_APPEARANCE, name: '' })
  const [mode, setMode] = useState<Mode>('guest')
  const [signup, setSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nameError, setNameError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const scope = useEntrance<HTMLElement>()

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(authErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const needName = () => {
    if (look.name.trim().length >= 2) return false
    setNameError('Имя — минимум 2 символа. Его увидят над вашим персонажем.')
    return true
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'guest') {
      if (needName()) return
      return run(() => enterAsGuest({ ...look, name: look.name.trim() }))
    }
    if (signup && needName()) return
    if (!email.trim() || !password) return setError('Введите почту и пароль')
    return run(() => enterWithEmail(signup ? 'signup' : 'signin', email, password, { ...look, name: look.name.trim() }))
  }

  return (
    <main ref={scope} className="mx-auto flex min-h-full max-w-6xl flex-col justify-center px-4 py-8 sm:px-8">
      <div data-enter>
        <Brand />
      </div>
      <h1 data-enter className="mt-8 text-balance max-w-lg font-display text-3xl leading-tight font-bold sm:text-[2.6rem]">Сядьте за один стол</h1>
      <p data-enter className="mt-3 max-w-lg text-fog">
        Комната на восемь мест для учёбы, работы и игр: голос и видео, общая доска, мафия, бункер и карты прямо за 3D-столом.
      </p>

      <form data-enter onSubmit={submit} className="glass mt-7 w-full max-w-xl rounded-3xl p-5 sm:p-6" noValidate>
        <CharacterEditor
          value={look}
          onChange={(v) => {
            setLook(v)
            setNameError('')
          }}
          nameError={nameError}
        />

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-ink/60 p-1" role="tablist" aria-label="Способ входа">
          {(
            [
              ['guest', 'Гостем'],
              ['email', 'Почта и пароль'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              disabled={id === 'email' && !firebaseEnabled}
              onClick={() => {
                setMode(id)
                setError('')
              }}
              className={`rounded-lg py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${mode === id ? 'bg-paper text-ink' : 'text-fog hover:text-paper'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'email' && (
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-fog">Почта</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                className="w-full rounded-xl bg-ink/70 px-3.5 py-2.5 ring-1 ring-white/12 focus:ring-mint focus:outline-none" />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-fog">Пароль</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={signup ? 'new-password' : 'current-password'} minLength={6}
                className="w-full rounded-xl bg-ink/70 px-3.5 py-2.5 ring-1 ring-white/12 focus:ring-mint focus:outline-none" />
            </div>
            <button type="button" onClick={() => setSignup((v) => !v)} className="text-sm text-mint underline-offset-4 hover:underline">
              {signup ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </button>
          </div>
        )}

        {error && <p role="alert" className="mt-4 text-sm text-alarm">{error}</p>}

        <button type="submit" disabled={busy} className="mt-5 w-full rounded-xl bg-mint py-3 font-bold text-ink transition hover:brightness-110 disabled:opacity-60">
          {busy ? 'Входим…' : mode === 'guest' ? 'Войти гостем' : signup ? 'Зарегистрироваться' : 'Войти'}
        </button>
        <button
          type="button"
          disabled={!firebaseEnabled || busy}
          onClick={() => run(() => enterWithGoogle({ ...look, name: look.name.trim() }))}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
          </svg>
          Войти через Google
        </button>
        {!firebaseEnabled && (
          <p className="mt-2 text-center text-xs text-fog/70">
            Вход по почте и через Google заработает, когда в .env появятся ключи Firebase (см. README).
          </p>
        )}
      </form>
    </main>
  )
}
