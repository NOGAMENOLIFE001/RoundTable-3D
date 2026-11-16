import { useState } from 'react'
import { RoomCanvas } from '../scene/RoomCanvas'
import { TopBar } from '../hud/TopBar'
import { ControlBar } from '../hud/ControlBar'
import { SidePanel } from '../hud/SidePanel'
import { Toasts } from '../hud/Toasts'
import { Roster } from '../hud/Roster'
import { StageOverlay } from '../hud/StageOverlay'
import { GamesPanel } from '../hud/GamesPanel'
import { CharacterModal } from '../hud/CharacterModal'
import { useRoom } from '../store/useRoomStore'
import { Appear } from '../lib/motion'

export function RoomScreen() {
  const [chatOpen, setChatOpen] = useState(() => window.innerWidth >= 1024)
  const [editing, setEditing] = useState(false)
  const panel = useRoom((s) => s.panel)

  return (
    <div className="relative h-full">
      <div className="absolute inset-0">
        <RoomCanvas />
      </div>
      {/* HUD поверх канваса; сам слой не перехватывает мышь, только его панели */}
      <div className="pointer-events-none absolute inset-0 z-30 flex flex-col p-2 sm:p-4">
        <Appear from="top">
          <TopBar chatOpen={chatOpen} onToggleChat={() => setChatOpen((v) => !v)} onEditCharacter={() => setEditing(true)} />
        </Appear>
        <Toasts />
        <div className="relative flex min-h-0 flex-1 gap-3 pt-3">
          <div className={`shrink-0 ${panel !== 'none' ? 'hidden lg:block' : ''}`}>
            <Appear from="left" delay={0.1}>
              <Roster />
            </Appear>
          </div>
          <div className="min-w-0 flex-1">
            {panel === 'stage' && (
              <Appear from="scale" key="stage">
                <StageOverlay />
              </Appear>
            )}
            {panel === 'games' && (
              <Appear from="scale" key="games">
                <GamesPanel />
              </Appear>
            )}
          </div>
          {chatOpen && (
            <Appear from="right">
              <SidePanel onClose={() => setChatOpen(false)} />
            </Appear>
          )}
        </div>
        <div className="flex justify-center pt-3">
          <Appear from="bottom" delay={0.15}>
            <ControlBar />
          </Appear>
        </div>
      </div>
      {editing && <CharacterModal onClose={() => setEditing(false)} />}
    </div>
  )
}
