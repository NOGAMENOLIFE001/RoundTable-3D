import { useApp } from './store/useAppStore'
import { AuthScreen } from './screens/AuthScreen'
import { LobbyScreen } from './screens/LobbyScreen'
import { RoomScreen } from './screens/RoomScreen'
import { ShowcaseCanvas } from './scene/ShowcaseCanvas'

export function App() {
  const screen = useApp((s) => s.screen)
  const profile = useApp((s) => s.profile)
  const authReady = useApp((s) => s.authReady)

  if (screen === 'room' && profile) return <RoomScreen />

  return (
    <div className="relative h-full">
      <div className="absolute inset-0">
        <ShowcaseCanvas />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/10" />
      <div className="relative h-full overflow-y-auto">
        {!authReady ? (
          <p className="flex h-full items-center justify-center text-fog" role="status">Проверяем вход…</p>
        ) : screen === 'auth' || !profile ? (
          <AuthScreen />
        ) : (
          <LobbyScreen />
        )}
      </div>
    </div>
  )
}
