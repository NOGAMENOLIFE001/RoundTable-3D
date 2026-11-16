import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import type { Look } from '../store/useAppStore'
import { ACCESSORIES, AVATAR_COLORS, AVATAR_STYLES, HAIR_COLORS, HAIR_STYLES, OUTFITS, SKIN_TONES } from '../lib/misc'
import { AvatarPreview } from '../scene/Avatar'

function Swatches({ label, colors, value, onPick }: { label: string; colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c === value}
          aria-label={`${label}: ${c}`}
          onClick={() => onPick(c)}
          className={`size-8 rounded-full transition ${c === value ? 'ring-2 ring-paper ring-offset-2 ring-offset-ink-2' : 'opacity-85 hover:opacity-100'}`}
          style={{ background: c }}
        />
      ))}
    </div>
  )
}

function Segments<T extends string>({ label, items, value, onPick }: { label: string; items: { id: T; label: string }[]; value: T; onPick: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="radio"
          aria-checked={it.id === value}
          onClick={() => onPick(it.id)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${it.id === value ? 'bg-paper text-ink' : 'bg-white/6 text-fog hover:text-paper'}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

const Row = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <p className="mb-1.5 text-xs font-semibold text-fog">{title}</p>
    {children}
  </div>
)

/** Редактор персонажа: превью в 3D + все настройки внешности */
export function CharacterEditor({ value, onChange, nameError }: { value: Look; onChange: (v: Look) => void; nameError?: string }) {
  // Последнее значение в ref: несколько изменений подряд не затирают друг друга
  const latest = useRef(value)
  latest.current = value
  const set = <K extends keyof Look>(k: K, v: Look[K]) => {
    latest.current = { ...latest.current, [k]: v }
    onChange(latest.current)
  }
  const human = value.style === 'classic'

  return (
    <div className="grid gap-5 sm:grid-cols-[150px_1fr]">
      <div className="mx-auto h-52 w-36 overflow-hidden rounded-2xl bg-ink-2/80 ring-1 ring-white/10 sm:mx-0 sm:h-64 sm:w-full">
        <Canvas camera={{ position: [0, 0, 3.4], fov: 36 }} dpr={[1, 2]} aria-label="Превью вашего персонажа">
          <ambientLight intensity={0.9} />
          <directionalLight position={[2, 3, 2]} intensity={2} />
          <group position-y={-0.95}>
            <AvatarPreview a={value} />
          </group>
        </Canvas>
      </div>

      <div className="space-y-3.5">
        <div>
          <label htmlFor="char-name" className="mb-1.5 block text-xs font-semibold text-fog">Имя за столом</label>
          <input
            id="char-name"
            value={value.name}
            onChange={(e) => set('name', e.target.value)}
            maxLength={24}
            autoComplete="nickname"
            placeholder="Например, Дилноза"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? 'char-name-error' : undefined}
            className="w-full rounded-xl bg-ink/70 px-3.5 py-2.5 ring-1 ring-white/12 placeholder:text-fog/60 focus:ring-mint focus:outline-none"
          />
          {nameError && <p id="char-name-error" className="mt-1.5 text-sm text-alarm">{nameError}</p>}
        </div>
        <Row title="Голова">
          <Segments label="Голова" items={AVATAR_STYLES} value={value.style} onPick={(v) => set('style', v)} />
        </Row>
        {human && (
          <>
            <Row title="Кожа">
              <Swatches label="Цвет кожи" colors={SKIN_TONES} value={value.skin} onPick={(v) => set('skin', v)} />
            </Row>
            <Row title="Причёска">
              <div className="space-y-2">
                <Segments label="Причёска" items={HAIR_STYLES} value={value.hair} onPick={(v) => set('hair', v)} />
                {value.hair !== 'none' && <Swatches label="Цвет волос" colors={HAIR_COLORS} value={value.hairColor} onPick={(v) => set('hairColor', v)} />}
              </div>
            </Row>
          </>
        )}
        <Row title="Одежда">
          <div className="space-y-2">
            <Segments label="Одежда" items={OUTFITS} value={value.outfit} onPick={(v) => set('outfit', v)} />
            <Swatches label="Цвет одежды" colors={AVATAR_COLORS} value={value.color} onPick={(v) => set('color', v)} />
          </div>
        </Row>
        <Row title="Аксессуар">
          <Segments label="Аксессуар" items={ACCESSORIES} value={value.accessory} onPick={(v) => set('accessory', v)} />
        </Row>
      </div>
    </div>
  )
}
