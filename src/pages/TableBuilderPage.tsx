import { useState } from 'react'
import type { JSX } from 'react'
import type { HandScenarioState } from '../../shared/schemas/lesson'
import { TableBuilder } from '../components/TableBuilder'
import { PokerTable } from '../components/PokerTable'

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
    <div className="space-y-10" style={{ background: '#07182C', minHeight: '100vh', padding: '2rem' }}>
      <div>
        <p
          className="text-[11px] font-mono uppercase tracking-widest mb-1"
          style={{ color: '#F4A024' }}
        >
          Admin · Table Builder
        </p>
        <h1 className="text-[22px] font-bold" style={{ color: '#EAF1F8' }}>
          Hand Scenario Builder
        </h1>
        <p className="text-[13px] mt-1" style={{ color: '#9DB2C9' }}>
          Click seats to add villains. Click hole card or board card slots to pick cards.
        </p>
      </div>

      <TableBuilder value={state} onChange={setState} />

      <div className="space-y-4">
        <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: '#F4A024' }}>
          Live preview
        </p>
        <div className="max-w-sm">
          <PokerTable tableState={state} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: '#F4A024' }}>
          Output (table_state)
        </p>
        <pre
          className="text-[12px] rounded-lg p-4 overflow-x-auto"
          style={{ background: '#0E2A47', color: '#9DB2C9', border: '1px solid #2a5079' }}
        >
          {JSON.stringify(state, null, 2)}
        </pre>
      </div>
    </div>
  )
}
