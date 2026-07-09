import { useState } from 'react'
import type { JSX } from 'react'
import type { HandScenarioState } from '../../shared/schemas/lesson'
import { TableBuilder } from '../components/TableBuilder'
import { PokerTable } from '../components/PokerTable'
import { TableBindPanel } from '../components/TableBindPanel'

const INITIAL: HandScenarioState = {
  street: 'preflop',
  hero_position: 'BTN',
  pot_size: 0,
  hero_hole_cards: [],
  board_cards: [],
  stack_sizes: { BTN: 500 },
  villain_player_types: {},
}

export function TableBuilderPage(): JSX.Element {
  const [state, setState] = useState<HandScenarioState>(INITIAL)

  return (
    <div className="space-y-10" style={{ background: '#18181b', minHeight: '100vh', padding: '2rem' }}>
      <div>
        <p
          className="text-[11px] font-mono uppercase tracking-widest mb-1"
          style={{ color: '#f59e0b' }}
        >
          Admin · Table Builder
        </p>
        <h1 className="text-[22px] font-bold" style={{ color: '#f4f4f5' }}>
          Hand Scenario Builder
        </h1>
        <p className="text-[13px] mt-1" style={{ color: '#a1a1aa' }}>
          Click seats to add villains. Click hole card or board card slots to pick cards.
        </p>
      </div>

      <TableBuilder
        value={state}
        onChange={setState}
        livePreviewSlot={
          <div style={{ width: 240 }}>
            <PokerTable tableState={state} size="sm" />
          </div>
        }
      />

      {/* Mobile-only live preview (hidden on lg where it appears inline above) */}
      <div className="space-y-4 lg:hidden flex flex-col items-center">
        <p className="text-[11px] font-mono uppercase tracking-widest text-center" style={{ color: '#f59e0b' }}>
          Live preview
        </p>
        <div className="max-w-sm w-full">
          <PokerTable tableState={state} />
        </div>
      </div>

      <TableBindPanel tableState={state} />

      <div className="space-y-2">
        <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: '#f59e0b' }}>
          Output (table_state)
        </p>
        <pre
          className="text-[12px] rounded-lg p-4 overflow-x-auto"
          style={{ background: '#27272a', color: '#a1a1aa', border: '1px solid #52525b' }}
        >
          {JSON.stringify(state, null, 2)}
        </pre>
      </div>
    </div>
  )
}
