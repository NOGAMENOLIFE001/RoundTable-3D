import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/protocol'
import { getIdToken } from './auth'

export type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/**
 * Один сокет на вкладку. По умолчанию — тот же origin (в dev Vite проксирует /socket.io),
 * для отдельного сервера задайте VITE_SERVER_URL.
 */
export const socket: RoomSocket = io(import.meta.env.VITE_SERVER_URL ?? '/', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  // Firebase ID-токен при каждом подключении (null в гостевом режиме без Firebase)
  auth: (cb) => {
    getIdToken().then((token) => cb({ token }), () => cb({ token: null }))
  },
})

/** Подключиться и дождаться соединения (или ошибки) */
export function ensureConnected(timeoutMs = 5000): Promise<void> {
  if (socket.connected) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const done = (err?: Error) => {
      clearTimeout(timer)
      socket.off('connect', onOk)
      socket.off('connect_error', onErr)
      if (err) {
        socket.disconnect()
        reject(err)
      } else resolve()
    }
    const onOk = () => done()
    const onErr = (e: Error) => done(e)
    const timer = setTimeout(() => done(new Error('timeout')), timeoutMs)
    socket.once('connect', onOk)
    socket.once('connect_error', onErr)
    socket.connect()
  })
}
