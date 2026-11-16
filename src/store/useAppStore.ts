import { create } from 'zustand'
import type { Profile } from '../types'
import { DEFAULT_APPEARANCE, type ProfileInput } from '../../shared/protocol'
import {
  firebaseEnabled, signInEmail, signInGoogle, signInGuest, signOutUser, watchAuth, type AuthUser,
} from '../lib/auth'
import { uid } from '../lib/misc'

type Screen = 'auth' | 'lobby' | 'room'

/** Имя и внешность — всё, что настраивается в редакторе персонажа */
export type Look = ProfileInput

/**
 * Профиль = аккаунт (Firebase uid или локальный id) + внешность.
 * Внешность хранится в localStorage по uid: на другом устройстве её выберут заново.
 */
const LOCAL_KEY = 'roundtable.profile' // профиль локального гостя (без Firebase)
const lookKey = (id: string) => `roundtable.look.${id}`

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* приватный режим — живём до перезагрузки */
  }
}

interface AppState {
  /** false, пока Firebase восстанавливает сессию */
  authReady: boolean
  account: AuthUser | null
  profile: Profile | null
  screen: Screen
  enterAsGuest: (look: Look) => Promise<void>
  enterWithEmail: (mode: 'signin' | 'signup', email: string, password: string, look: Look) => Promise<void>
  enterWithGoogle: (look: Look) => Promise<void>
  logout: () => Promise<void>
  /** Сохранить изменения из редактора персонажа */
  updateLook: (look: Look) => void
  setScreen: (s: Screen) => void
  /** Сообщение для лобби (например, «связь прервалась») */
  notice: string | null
  setNotice: (n: string | null) => void
}

/** Внешность, выбранная прямо перед входом (до того, как Firebase сообщит uid) */
let pendingLook: Look | null = null

function profileFor(account: AuthUser, look: Look | null): Profile {
  const saved = read<Look>(lookKey(account.uid))
  const l = look ?? saved ?? pendingLook
  const name = (l?.name || account.displayName || account.email?.split('@')[0] || 'Гость').slice(0, 24)
  return { ...DEFAULT_APPEARANCE, ...l, id: account.uid, name }
}

const storedGuest = firebaseEnabled ? null : read<Profile>(LOCAL_KEY)
// Профили со старых версий дополняем новыми полями внешности
const localGuest: Profile | null = storedGuest ? { ...DEFAULT_APPEARANCE, ...storedGuest } : null

export const useApp = create<AppState>((set, get) => {
  const signedIn = (account: AuthUser, look: Look | null) => {
    const profile = profileFor(account, look)
    const { id: _id, ...savedLook } = profile
    write(lookKey(account.uid), savedLook)
    pendingLook = null
    set({ account, profile, screen: get().screen === 'auth' ? 'lobby' : get().screen })
  }

  if (firebaseEnabled) {
    watchAuth((account) => {
      if (account) signedIn(account, null)
      else set({ account: null, profile: null, screen: 'auth' })
      set({ authReady: true })
    })
  }

  return {
    authReady: !firebaseEnabled,
    account: null,
    profile: localGuest,
    screen: localGuest ? 'lobby' : 'auth',

    enterAsGuest: async (look) => {
      pendingLook = look
      const account = await signInGuest()
      if (account) return signedIn(account, look)
      // Без Firebase — локальный гость, как на Этапах 1–3
      const profile: Profile = { id: uid(), ...look }
      write(LOCAL_KEY, profile)
      set({ profile, screen: 'lobby' })
    },

    enterWithEmail: async (mode, email, password, look) => {
      pendingLook = look
      signedIn(await signInEmail(mode, email.trim(), password, look.name), look.name ? look : { ...look, name: '' })
    },

    enterWithGoogle: async (look) => {
      pendingLook = look
      const account = await signInGoogle()
      // Имя из поля, а если пусто — из Google-аккаунта
      signedIn(account, { ...look, name: look.name || account.displayName || '' })
    },

    logout: async () => {
      await signOutUser()
      write(LOCAL_KEY, null)
      set({ account: null, profile: null, screen: 'auth' })
    },

    updateLook: (look) => {
      const cur = get().profile
      if (!cur) return
      const profile: Profile = { ...cur, ...look, name: look.name.trim().slice(0, 24) || cur.name }
      if (get().account) write(lookKey(cur.id), { ...look, name: profile.name })
      else write(LOCAL_KEY, profile)
      set({ profile })
    },

    setScreen: (screen) => set({ screen }),
    notice: null,
    setNotice: (notice) => set({ notice }),
  }
})
