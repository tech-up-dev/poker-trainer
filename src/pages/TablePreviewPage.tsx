import type { JSX } from 'react'
import { PokerTable } from '../components/PokerTable'
import type { HandScenarioState } from '../../shared/schemas/lesson'

const SAMPLE: HandScenarioState = {
  street: 'preflop',
  hero_position: 'HJ',
  hero_hole_cards: ['Jh', 'Js'],
  board_cards: [],
  pot_size: 70,
  stack_sizes: {
    BTN: 452,
    SB: 500,
    BB: 500,
    UTG: 600,
    'UTG+1': 800,
    MP: 300,
    'MP+1': 420,
    HJ: 500,
    CO: 380,
  },
  villain_player_types: {
    BTN: 'GTO',
    UTG: 'OMC',
    MP: 'PLF',
  },
  seat_actions: {
    UTG: { action: 'Call', amount: 5 },
    MP: { action: 'Call', amount: 5 },
    HJ: { action: 'Raise', amount: 15 },
    BTN: { action: '3-bet', amount: 48 },
    SB: { action: 'Fold' },
    BB: { action: 'Fold' },
  },
}

const SAMPLE_FLOP: HandScenarioState = {
  street: 'flop',
  hero_position: 'BTN',
  hero_hole_cards: ['Ah', 'Kd'],
  board_cards: ['7h', '8c', '2d'],
  pot_size: 120,
  stack_sizes: {
    BTN: 480,
    SB: 460,
    BB: 395,
    UTG: 600,
    'UTG+1': 800,
    MP: 300,
    'MP+1': 420,
    HJ: 500,
    CO: 380,
  },
  villain_player_types: {
    BB: 'PLF',
    CO: 'DWM',
  },
  seat_actions: {
    BB: { action: 'Bet', amount: 60 },
    CO: { action: 'Fold' },
  },
}

export function TablePreviewPage(): JSX.Element {
  return (
    <div className="min-h-screen py-8 px-4" style={{ background: '#07182C' }}>
      <div className="max-w-sm mx-auto space-y-10">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest mb-1" style={{ color: '#F4A024' }}>
            Table preview · feat/app-poker-table
          </p>
          <h1 className="text-[22px] font-bold" style={{ color: '#EAF1F8' }}>
            Poker Table Component
          </h1>
          <p className="text-[13px] mt-1" style={{ color: '#9DB2C9' }}>
            Tap any coloured seat to open the player-type scout card.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[13px] font-semibold" style={{ color: '#EAF1F8' }}>
              Scenario 1 - Preflop 3-bet pot
            </p>
            <p className="text-[12px]" style={{ color: '#9DB2C9' }}>
              Hero: HJ · JJ · faces BTN 3-bet to $48
            </p>
          </div>
          <PokerTable tableState={SAMPLE} />
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[13px] font-semibold" style={{ color: '#EAF1F8' }}>
              Scenario 2 - Flop bet facing hero on BTN
            </p>
            <p className="text-[12px]" style={{ color: '#9DB2C9' }}>
              Hero: BTN · AKo · flop 7♥ 8♣ 2♦
            </p>
          </div>
          <PokerTable tableState={SAMPLE_FLOP} />
        </div>
      </div>
    </div>
  )
}
