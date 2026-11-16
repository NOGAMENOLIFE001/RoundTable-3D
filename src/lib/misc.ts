import type { Accessory, AvatarStyle, Hair, Outfit } from '../types'

export const uid = () => crypto.randomUUID()

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // без 0/O и 1/I
export function generateRoomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
export const isValidCode = (s: string) => /^[A-Z0-9]{6}$/.test(s)

// ---------- редактор персонажа ----------

export const AVATAR_COLORS = ['#5EF2C7', '#E0B15C', '#FF8FAB', '#7AA7FF', '#B48CFF', '#FF9F5A', '#9BE564', '#E8EDF5']
export const SKIN_TONES = ['#F5D6BE', '#E9C8A8', '#D7A57E', '#B97F57', '#8D5A3B', '#5E3B27']
export const HAIR_COLORS = ['#1E1B1A', '#3B2A20', '#7A4A2A', '#C8963E', '#E8D3A0', '#B5482F', '#9AA3B5', '#5EF2C7']

export const AVATAR_STYLES: { id: AvatarStyle; label: string }[] = [
  { id: 'classic', label: 'Человек' },
  { id: 'robot', label: 'Робот' },
  { id: 'round', label: 'Шлем' },
]
export const HAIR_STYLES: { id: Hair; label: string }[] = [
  { id: 'none', label: 'Без' },
  { id: 'short', label: 'Короткие' },
  { id: 'long', label: 'Длинные' },
  { id: 'bun', label: 'Пучок' },
  { id: 'mohawk', label: 'Ирокез' },
  { id: 'curly', label: 'Кудри' },
]
export const OUTFITS: { id: Outfit; label: string }[] = [
  { id: 'tee', label: 'Футболка' },
  { id: 'hoodie', label: 'Худи' },
  { id: 'suit', label: 'Пиджак' },
]
export const ACCESSORIES: { id: Accessory; label: string }[] = [
  { id: 'none', label: 'Нет' },
  { id: 'glasses', label: 'Очки' },
  { id: 'headphones', label: 'Наушники' },
  { id: 'cap', label: 'Кепка' },
  { id: 'crown', label: 'Корона' },
  { id: 'bow', label: 'Бантик' },
]

export { REACTIONS } from '../../shared/protocol'

export const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

/** Стабильное число из строки — чтобы у каждого аватара была своя фаза анимации */
export function hashSeed(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return (Math.abs(h) % 1000) / 100
}
