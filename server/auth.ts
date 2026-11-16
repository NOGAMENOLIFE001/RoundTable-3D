import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

/**
 * Проверка Firebase ID-токена при подключении сокета.
 * Включается, если задан FIREBASE_PROJECT_ID (или VITE_FIREBASE_PROJECT_ID из .env).
 * Для проверки подписи нужен только projectId — ключ сервисного аккаунта не требуется.
 */
const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID

export const authRequired = Boolean(projectId)

const auth = projectId ? getAuth(initializeApp({ projectId })) : null

export async function verifyToken(token: unknown): Promise<string | null> {
  if (!auth) return null
  if (typeof token !== 'string' || !token) throw new Error('unauthorized')
  const decoded = await auth.verifyIdToken(token)
  return decoded.uid
}
