import type { JSX } from 'react'

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const
const SUITS = ['s', 'h', 'd', 'c'] as const

const SUIT_META: Record<string, { symbol: string; red: boolean }> = {
  s: { symbol: '♠', red: false },
  h: { symbol: '♥', red: true },
  d: { symbol: '♦', red: true },
  c: { symbol: '♣', red: false },
}

function norm(card: string): string {
  return card.slice(0, -1).toUpperCase() + card.slice(-1).toLowerCase()
}

export interface CardPickerProps {
  value: string | null
  usedCards: string[]
  onChange: (card: string | null) => void
}

export function CardPicker({ value, usedCards, onChange }: CardPickerProps): JSX.Element {
  const usedSet = new Set(usedCards.map(norm))
  const normValue = value ? norm(value) : null

  return (
    <div className="inline-block space-y-0.5">
      {SUITS.map((suit) => (
        <div key={suit} className="flex gap-0.5">
          {RANKS.map((rank) => {
            const code = rank + suit
            const isSelected = normValue === code
            const isUsed = !isSelected && usedSet.has(code)
            const { red } = SUIT_META[suit]

            return (
              <button
                key={code}
                type="button"
                disabled={isUsed}
                onClick={() => onChange(isSelected ? null : code)}
                className={[
                  'w-7 h-8 rounded text-[10px] font-bold leading-none flex flex-col items-center justify-center gap-px select-none transition-colors',
                  isSelected
                    ? 'bg-[#F4A024] text-[#07182C]'
                    : isUsed
                      ? 'bg-[#0f1e2e] text-[#3a5068] cursor-not-allowed'
                      : red
                        ? 'bg-[#1a2e45] text-[#D6483B] hover:bg-[#243d58] cursor-pointer'
                        : 'bg-[#1a2e45] text-[#EAF1F8] hover:bg-[#243d58] cursor-pointer',
                ].join(' ')}
              >
                <span>{rank === 'T' ? '10' : rank}</span>
                <span className="text-[8px]">{SUIT_META[suit].symbol}</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
