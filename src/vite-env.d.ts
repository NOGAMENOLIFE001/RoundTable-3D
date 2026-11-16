/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Адрес Socket.io-сервера, если он не за прокси Vite */
  readonly VITE_SERVER_URL?: string
  /** JSON-массив RTCIceServer (STUN/TURN) */
  readonly VITE_ICE_SERVERS?: string
}
