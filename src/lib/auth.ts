import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, getAuth, onAuthStateChanged,
  signInAnonymously, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile,
  type Auth, type User,
} from 'firebase/auth'

/**
 * Firebase Auth. Ключи берутся из .env (см. .env.example).
 * Без ключей приложение работает в локальном гостевом режиме, как раньше.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseEnabled = Boolean(config.apiKey && config.authDomain && config.projectId)

let app: FirebaseApp | null = null
let auth: Auth | null = null
function getFirebaseAuth(): Auth {
  if (!firebaseEnabled) throw new Error('firebase-disabled')
  app ??= initializeApp(config)
  auth ??= getAuth(app)
  return auth
}

export interface AuthUser {
  uid: string
  displayName: string | null
  email: string | null
  provider: 'guest' | 'password' | 'google'
}

const toAuthUser = (u: User): AuthUser => ({
  uid: u.uid,
  displayName: u.displayName,
  email: u.email,
  provider: u.isAnonymous ? 'guest' : u.providerData.some((p) => p.providerId === 'google.com') ? 'google' : 'password',
})

/** Подписка на вход/выход. Первый вызов — восстановленная сессия или null. */
export function watchAuth(cb: (u: AuthUser | null) => void): () => void {
  if (!firebaseEnabled) {
    cb(null)
    return () => {}
  }
  return onAuthStateChanged(getFirebaseAuth(), (u) => cb(u ? toAuthUser(u) : null))
}

export async function signInGuest(): Promise<AuthUser | null> {
  if (!firebaseEnabled) return null
  return toAuthUser((await signInAnonymously(getFirebaseAuth())).user)
}

export async function signInEmail(mode: 'signin' | 'signup', email: string, password: string, name: string) {
  const a = getFirebaseAuth()
  const cred = mode === 'signup'
    ? await createUserWithEmailAndPassword(a, email, password)
    : await signInWithEmailAndPassword(a, email, password)
  if (mode === 'signup' && name) await updateProfile(cred.user, { displayName: name })
  return { ...toAuthUser(cred.user), displayName: cred.user.displayName ?? (name || null) }
}

export async function signInGoogle() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return toAuthUser((await signInWithPopup(getFirebaseAuth(), provider)).user)
}

export async function signOutUser() {
  if (firebaseEnabled) await signOut(getFirebaseAuth())
}

/** ID-токен для сервера (Socket.io handshake). null — гостевой режим без Firebase. */
export async function getIdToken(): Promise<string | null> {
  if (!firebaseEnabled) return null
  return (await getFirebaseAuth().currentUser?.getIdToken()) ?? null
}

const ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Неверный email или пароль.',
  'auth/invalid-email': 'Проверьте адрес почты, в нём ошибка.',
  'auth/user-disabled': 'Этот аккаунт отключён.',
  'auth/email-already-in-use': 'Аккаунт с этой почтой уже есть. Войдите вместо регистрации.',
  'auth/weak-password': 'Пароль слишком простой: нужно минимум 6 символов.',
  'auth/missing-password': 'Введите пароль.',
  'auth/too-many-requests': 'Слишком много попыток. Подождите пару минут.',
  'auth/network-request-failed': 'Нет связи с Firebase. Проверьте интернет.',
  'auth/popup-closed-by-user': 'Окно Google закрыто до завершения входа.',
  'auth/cancelled-popup-request': 'Окно Google закрыто до завершения входа.',
  'auth/popup-blocked': 'Браузер заблокировал окно Google. Разрешите всплывающие окна для этого сайта.',
  'auth/operation-not-allowed': 'Этот способ входа выключен в консоли Firebase (Authentication → Sign-in method).',
  'auth/admin-restricted-operation': 'Гостевой вход выключен в консоли Firebase: включите провайдер Anonymous.',
  'auth/unauthorized-domain': 'Домен не разрешён в Firebase: добавьте его в Authentication → Settings → Authorized domains.',
  'auth/invalid-api-key': 'Неверный VITE_FIREBASE_API_KEY в .env.',
}

export function authErrorText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  return ERRORS[code] ?? `Не удалось войти${code ? ` (${code})` : ''}. Попробуйте ещё раз.`
}
