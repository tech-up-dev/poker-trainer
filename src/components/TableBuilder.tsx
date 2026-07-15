import { useState } from 'react'
import type { JSX, ReactNode } from 'react'
import type { HandScenarioState } from '../../shared/schemas/lesson'
import { Card } from './Card'
import { CardPicker } from './CardPicker'

// --- Constants (mirrors PokerTable) -----------------------------------------

const POSITIONS = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'] as const
type Position = (typeof POSITIONS)[number]

const PLAYER_TYPE_CODES = ['OMC', 'PLF', 'Y2K', 'GTO', 'DWM', 'STP'] as const

const SEAT_ACTIONS = ['Fold', 'Check', 'Limp', 'Call', 'Bet', 'Raise', '3-bet', '4-bet', 'All-in'] as const
type SeatAction = (typeof SEAT_ACTIONS)[number]
const ACTIONS_WITH_AMOUNT: SeatAction[] = ['Call', 'Bet', 'Raise', '3-bet', '4-bet', 'All-in']

const STREETS = ['preflop', 'flop', 'turn', 'river'] as const
type Street = (typeof STREETS)[number]

const BOARD_SLOTS: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 }

type Align = 'center' | 'flex-start' | 'flex-end'

// Identical to PokerTable SLOTS
const SLOTS: { style: React.CSSProperties; align: Align }[] = [
  { style: { left: '50%', top: '90%', transform: 'translate(-50%, -50%)' }, align: 'center' },
  { style: { right: '2%', top: '72%', transform: 'translateY(-50%)' }, align: 'flex-end' },
  { style: { right: '2%', top: '50%', transform: 'translateY(-50%)' }, align: 'flex-end' },
  { style: { right: '2%', top: '28%', transform: 'translateY(-50%)' }, align: 'flex-end' },
  { style: { left: '65%', top: '6%', transform: 'translateX(-50%)' }, align: 'center' },
  { style: { left: '35%', top: '6%', transform: 'translateX(-50%)' }, align: 'center' },
  { style: { left: '2%', top: '28%', transform: 'translateY(-50%)' }, align: 'flex-start' },
  { style: { left: '2%', top: '50%', transform: 'translateY(-50%)' }, align: 'flex-start' },
  { style: { left: '2%', top: '72%', transform: 'translateY(-50%)' }, align: 'flex-start' },
]

function normalisePos(pos: string): string {
  return pos
    .replace(/^MP\+1$/i, 'LJ')
    .replace(/^MP$/i, 'UTG+2')
    .toUpperCase()
}

function getSeatedPositions(heroPosition: string): string[] {
  const hero = normalisePos(heroPosition)
  const idx = (POSITIONS as readonly string[]).indexOf(hero)
  if (idx < 0) return [...POSITIONS]
  return [...POSITIONS.slice(idx), ...POSITIONS.slice(0, idx)]
}

// --- Shared sub-components (same visual tokens as PokerTable) ----------------

// Full pill used for hero seat in the interactive table
function HeroPill({
  position,
  stack,
  isBtn,
}: {
  position: string
  stack?: number
  isBtn: boolean
}): JSX.Element {
  return (
    <div className="inline-flex items-center gap-1">
      <div className="inline-flex rounded-[11px] overflow-hidden border border-line">
        <span className="bg-surface text-ink text-[11px] px-[7px] py-[3px] leading-none whitespace-nowrap">
          {position}
        </span>
        {stack !== undefined && (
          <span className="bg-surface-overlay text-ink text-[11px] px-[8px] py-[3px] leading-none whitespace-nowrap">
            ${stack}
          </span>
        )}
      </div>
      {isBtn && (
        <div className="w-[18px] h-[18px] rounded-full bg-gold text-on-gold text-[10px] font-bold flex items-center justify-center flex-shrink-0">
          D
        </div>
      )}
    </div>
  )
}

// Compact position-only pill for villain/background seats - keeps width narrow
function SeatPill({
  position,
  isBtn,
}: {
  position: string
  isBtn: boolean
}): JSX.Element {
  return (
    <div className="inline-flex items-center gap-1">
      <div className="inline-flex rounded-[10px] border border-line bg-surface">
        <span className="text-ink text-[10px] font-medium px-[6px] py-[2px] leading-none whitespace-nowrap">
          {position}
        </span>
      </div>
      {isBtn && (
        <div className="w-[15px] h-[15px] rounded-full bg-gold text-on-gold text-[9px] font-bold flex items-center justify-center flex-shrink-0">
          D
        </div>
      )}
    </div>
  )
}


function EmptyCardSlot(): JSX.Element {
  return (
    <div className="w-[30px] h-[42px] rounded border-2 border-dashed border-line flex items-center justify-center">
      <span className="text-ink-3 text-[18px] leading-none font-light">+</span>
    </div>
  )
}

// Two tiny vertical flush face-down cards - mirrors PokerTable's MiniCards
function MiniCards(): JSX.Element {
  const cardStyle: React.CSSProperties = {
    width: 11,
    height: 18,
    borderRadius: 2,
    border: '1px solid rgba(42,80,121,0.8)',
    background: 'repeating-linear-gradient(45deg,#1b4068,#1b4068 2px,#16395C 2px,#16395C 4px)',
    flexShrink: 0,
  }
  return (
    <div className="flex items-center" style={{ gap: 1 }}>
      <div style={cardStyle} />
      <div style={cardStyle} />
    </div>
  )
}

// Combined pill for villain seats: [POSITION | TYPE_CODE] + optional dealer button
function VillainPill({
  position,
  typeCode,
  isBtn,
  isSelected,
}: {
  position: string
  typeCode?: string
  isBtn: boolean
  isSelected?: boolean
}): JSX.Element {
  return (
    <div
      className="inline-flex items-center gap-1"
      style={isSelected ? { outline: '2px solid var(--color-gold)', borderRadius: 10 } : {}}
    >
      <div className="inline-flex rounded-[10px] overflow-hidden border border-line">
        <span className="bg-surface text-ink text-[10px] font-medium px-[6px] py-[2px] leading-none whitespace-nowrap">
          {position}
        </span>
        {typeCode && (
          <span className="bg-surface-overlay text-gold text-[10px] font-semibold px-[6px] py-[2px] leading-none whitespace-nowrap">
            {typeCode}
          </span>
        )}
      </div>
      {isBtn && (
        <div className="w-[15px] h-[15px] rounded-full bg-gold text-on-gold text-[9px] font-bold flex items-center justify-center flex-shrink-0">
          D
        </div>
      )}
    </div>
  )
}

// --- Main component ----------------------------------------------------------

export interface TableBuilderProps {
  value: HandScenarioState
  onChange: (state: HandScenarioState) => void
  livePreviewSlot?: ReactNode
}

type EditingSlot =
  | { kind: 'hole'; index: 0 | 1 }
  | { kind: 'board'; index: number }

export function TableBuilder({ value, onChange, livePreviewSlot }: TableBuilderProps): JSX.Element {
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null)
  const [editingSlot, setEditingSlot] = useState<EditingSlot | null>(null)
  const [heroOpen, setHeroOpen] = useState(false)

  const street = value.street as Street
  const heroPos = normalisePos(value.hero_position)
  const seatedPositions = getSeatedPositions(value.hero_position)
  const boardSlotCount = BOARD_SLOTS[street]

  const holeCards: [string | null, string | null] = [
    value.hero_hole_cards?.[0] ?? null,
    value.hero_hole_cards?.[1] ?? null,
  ]
  // Always length-5 array; nulls = empty slots
  const boardCards: (string | null)[] = Array.from(
    { length: 5 },
    (_, i) => value.board_cards?.[i] ?? null,
  )

  // All non-null cards except the one currently being edited (so it stays selectable)
  const usedCards = (() => {
    const editCard =
      editingSlot?.kind === 'hole'
        ? holeCards[editingSlot.index]
        : editingSlot?.kind === 'board'
          ? boardCards[editingSlot.index]
          : null
    return [
      ...holeCards,
      ...boardCards.slice(0, boardSlotCount),
    ].filter((c): c is string => c !== null && c !== editCard)
  })()

  const pickerValue =
    editingSlot?.kind === 'hole'
      ? holeCards[editingSlot.index]
      : editingSlot?.kind === 'board'
        ? boardCards[editingSlot.index]
        : null

  // -- Update helpers --------------------------------------------------------

  function patch(updates: Partial<HandScenarioState>): void {
    onChange({ ...value, ...updates })
  }

  function setStreet(s: Street): void {
    const max = BOARD_SLOTS[s]
    const trimmed = (value.board_cards ?? []).slice(0, max)
    patch({ street: s, board_cards: trimmed.length > 0 ? trimmed : undefined })
    if (editingSlot?.kind === 'board' && editingSlot.index >= max) setEditingSlot(null)
  }

  function setHeroPos(pos: Position): void {
    const types = { ...(value.villain_player_types ?? {}) }
    const stacks = { ...(value.stack_sizes ?? {}) }
    // The new hero seat can't also be a villain
    if (types[pos]) {
      delete types[pos]
      delete stacks[pos]
    }
    if (selectedSeat === pos) setSelectedSeat(null)
    patch({ hero_position: pos, villain_player_types: types, stack_sizes: stacks })
  }

  function toggleSeat(pos: string): void {
    const types = { ...(value.villain_player_types ?? {}) }
    const stacks = { ...(value.stack_sizes ?? {}) }
    if (types[pos]) {
      delete types[pos]
      delete stacks[pos]
      if (selectedSeat === pos) setSelectedSeat(null)
    } else {
      types[pos] = 'OMC'
      stacks[pos] = 500
      setSelectedSeat(pos)
    }
    patch({ villain_player_types: types, stack_sizes: stacks })
  }

  function setSeatType(pos: string, code: string): void {
    patch({ villain_player_types: { ...(value.villain_player_types ?? {}), [pos]: code } })
  }

  function setSeatStack(pos: string, stack: number): void {
    patch({ stack_sizes: { ...(value.stack_sizes ?? {}), [pos]: stack } })
  }

  function setSeatAction(pos: string, action: SeatAction | null): void {
    const next = { ...(value.seat_actions ?? {}) }
    if (action === null) {
      delete next[pos]
    } else {
      next[pos] = { action, amount: next[pos]?.amount }
    }
    patch({ seat_actions: Object.keys(next).length > 0 ? next : undefined })
  }

  function setSeatActionAmount(pos: string, amount: number | undefined): void {
    const existing = value.seat_actions?.[pos]
    if (!existing) return
    const next = { ...(value.seat_actions ?? {}), [pos]: { ...existing, amount } }
    patch({ seat_actions: next })
  }

  function pickHoleCard(index: 0 | 1, card: string | null): void {
    const next: [string | null, string | null] = [holeCards[0], holeCards[1]]
    next[index] = card
    patch({ hero_hole_cards: next.filter((c): c is string => c !== null) })
    if (card !== null) setEditingSlot(null)
  }

  function openHeroConfig(slotIndex: 0 | 1): void {
    setHeroOpen(true)
    toggleEditSlot({ kind: 'hole', index: slotIndex })
  }

  function pickBoardCard(index: number, card: string | null): void {
    const next = [...boardCards]
    next[index] = card
    // Clearing a slot also clears subsequent slots (keeps array dense)
    if (card === null) {
      for (let i = index + 1; i < 5; i++) next[i] = null
    }
    const filled = next.filter((c): c is string => c !== null)
    patch({ board_cards: filled.length > 0 ? filled : undefined })
    if (card !== null) setEditingSlot(null)
  }

  function handlePickerChange(card: string | null): void {
    if (!editingSlot) return
    if (editingSlot.kind === 'hole') pickHoleCard(editingSlot.index as 0 | 1, card)
    else pickBoardCard(editingSlot.index, card)
  }

  function toggleEditSlot(slot: EditingSlot): void {
    setEditingSlot((prev) =>
      prev?.kind === slot.kind && prev.index === slot.index ? null : slot,
    )
  }

  // -- Render ----------------------------------------------------------------

  const selectedSeatType = selectedSeat ? (value.villain_player_types?.[selectedSeat] ?? null) : null
  const selectedSeatStack = selectedSeat ? (value.stack_sizes?.[selectedSeat] ?? 500) : 500

  return (
    <div className="space-y-4" style={{ userSelect: 'none' }}>

      {/* -- Top controls ---------------------------------------------------- */}
      <div className={livePreviewSlot ? 'flex gap-6 items-start' : ''}>

      {/* Left: street tabs + fields */}
      <div className={livePreviewSlot ? 'flex-1 space-y-2' : 'space-y-2'}>

        {/* Street tabs */}
        <div className="flex lg:inline-flex rounded-lg overflow-hidden border border-line">
          {STREETS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStreet(s)}
              className={`flex-1 sm:flex-none sm:px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${
                street === s
                  ? 'bg-gold text-on-gold'
                  : 'bg-surface text-ink-2 hover:bg-surface-overlay'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Pot + Hero + Hero stack */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12px] text-ink-2">
            Pot&nbsp;$
            <input
              type="number"
              min={0}
              value={value.pot_size ?? ''}
              onChange={(e) =>
                patch({ pot_size: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })
              }
              placeholder="0"
              className="w-20 rounded bg-surface border border-line text-ink text-[12px] px-2 py-1 outline-none focus:border-link"
              style={{ userSelect: 'text' }}
            />
          </label>

          <label className="flex items-center gap-1.5 text-[12px] text-ink-2">
            Hero
            <select
              value={heroPos}
              onChange={(e) => setHeroPos(e.target.value as Position)}
              className="rounded bg-surface border border-line text-ink text-[12px] px-2 py-1 outline-none focus:border-link"
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-[12px] text-ink-2">
            Hero stack&nbsp;$
            <input
              type="number"
              min={0}
              value={value.stack_sizes?.[heroPos] ?? ''}
              onChange={(e) =>
                setSeatStack(heroPos, Math.max(0, Number(e.target.value)))
              }
              placeholder="500"
              className="w-20 rounded bg-surface border border-line text-ink text-[12px] px-2 py-1 outline-none focus:border-link"
              style={{ userSelect: 'text' }}
            />
          </label>
        </div>
      </div>

      {/* Right: "Live preview" label */}
      {livePreviewSlot && (
        <div className="hidden lg:flex flex-1 items-center justify-center">
          <p className="text-[11px] font-mono uppercase tracking-widest text-gold">
            Live preview
          </p>
        </div>
      )}

      </div>{/* end controls row */}

      {/* -- Main: table + config panel --------------------------------------- */}
      <div className={livePreviewSlot ? 'flex flex-col lg:flex-row gap-6 lg:items-start' : 'flex flex-col sm:flex-row flex-wrap gap-6 sm:items-start'}>

        {/* Left column: interactive table + config panel */}
        <div className={livePreviewSlot ? 'w-full lg:flex-1 lg:min-w-0 space-y-5' : 'contents'}>

        {/* -- Interactive oval table ---------------------------------------- */}
        <div className={livePreviewSlot ? 'mx-auto' : 'mx-auto sm:mx-0 flex-shrink-0'} style={{ width: 240 }}>

          <div className="relative w-full" style={{ height: 360 }}>

            {/* Leather rail - intentional decorative color, not theme */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(180deg,#7A4E2A 0%,#5E3A1F 65%)',
                boxShadow: 'inset 0 0 0 1px rgba(201,154,106,0.35)',
              }}
            />
            {/* Green felt - intentional decorative color, not theme */}
            <div
              className="absolute rounded-full"
              style={{
                inset: '12px 10px',
                background: '#1C6B43',
                boxShadow: 'inset 0 0 36px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(0,0,0,0.18)',
              }}
            />

            {/* Center: pot + board preview */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-2 pointer-events-none">
              {(value.pot_size ?? 0) > 0 && (
                <div
                  className="text-ink text-[12px] px-3 py-[4px] rounded-[13px] border border-line"
                  style={{ background: 'rgba(9,9,11,0.55)' }}
                >
                  Pot <strong className="font-semibold">${value.pot_size}</strong>
                </div>
              )}
              {boardCards.filter(Boolean).length > 0 && (
                <div className="flex gap-[3px]">
                  {boardCards.slice(0, boardSlotCount).map((c, i) =>
                    c ? <Card key={i} card={c} size="sm" /> : null,
                  )}
                </div>
              )}
              {street === 'preflop' && boardCards.filter(Boolean).length === 0 && (
                <div
                  className="text-ink-3 text-[10px] px-2 py-[2px] rounded uppercase tracking-widest"
                  style={{ background: 'rgba(9,9,11,0.28)' }}
                >
                  Preflop
                </div>
              )}
            </div>

            {/* Seats */}
            {seatedPositions.map((pos, slotIdx) => {
              const slot = SLOTS[slotIdx]
              const isHero = normalisePos(pos) === heroPos
              const typeCode = value.villain_player_types?.[pos]
              const isActive = Boolean(typeCode)
              const isSelected = selectedSeat === pos
              const stack = value.stack_sizes?.[pos]

              return (
                <div key={pos} className="absolute z-20" style={slot.style}>
                  {isHero ? (
                    <div className="flex flex-col items-center gap-[4px]">
                      <div
                        className="flex flex-col items-center gap-[5px] p-[5px] rounded-[14px]"
                        style={{
                          border: '2px solid var(--color-gold)',
                          boxShadow: '0 0 0 4px rgba(244,160,36,0.18)',
                        }}
                      >
                        {/* Hole card slots */}
                        <div className="flex gap-0.5">
                          {([0, 1] as const).map((i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => openHeroConfig(i)}
                              className={`rounded outline-none transition-shadow ${
                                heroOpen && editingSlot?.kind === 'hole' && editingSlot.index === i
                                  ? 'ring-2 ring-gold'
                                  : ''
                              }`}
                            >
                              {holeCards[i] ? (
                                <Card card={holeCards[i] as string} />
                              ) : (
                                <EmptyCardSlot />
                              )}
                            </button>
                          ))}
                        </div>
                        <HeroPill position={heroPos} stack={stack} isBtn={heroPos === 'BTN'} />
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        isActive
                          ? setSelectedSeat(pos)
                          : toggleSeat(pos)
                      }
                      className="relative flex flex-col gap-[2px] cursor-pointer transition-opacity"
                      style={{ alignItems: slot.align, minWidth: 44 }}
                      aria-label={
                        isActive
                          ? `${typeCode ?? ''} at ${pos}, tap to configure`
                          : `Empty seat ${pos}, tap to add villain`
                      }
                    >
                      {/* Active villain: mini cards (absolute above pill) → combined pill → stack text */}
                      {isActive ? (
                        <>
                          <div
                            className="absolute bottom-full pointer-events-none pb-[3px]"
                            style={{ display: 'flex', justifyContent: slot.align }}
                          >
                            <MiniCards />
                          </div>
                          <VillainPill
                            position={pos}
                            typeCode={typeCode}
                            isBtn={pos === 'BTN'}
                            isSelected={isSelected}
                          />
                          {stack !== undefined && (
                            <span className="text-[10px] text-ink font-medium leading-none">${stack}</span>
                          )}
                        </>
                      ) : (
                        <>
                          <SeatPill position={pos} isBtn={pos === 'BTN'} />
                          <span
                            className="text-[10px] leading-none font-semibold px-[6px] py-[2px] rounded-full"
                            style={{ background: 'rgba(255,255,255,0.85)', color: '#1C6B43' }}
                          >
                            + add
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* -- Config panel ---------------------------------------------------- */}
        <div className={livePreviewSlot ? 'space-y-5 flex flex-col items-center' : 'flex-1 min-w-0 space-y-5'}>

          {/* Villain seat config - open until Apply is clicked */}
          {selectedSeat && selectedSeatType && (
            <div className="space-y-3 p-3 rounded-lg border border-gold/40 bg-surface">
              <div className="flex items-center justify-between">
                <span className="text-ink text-[13px] font-semibold">{selectedSeat} - configure</span>
                <button
                  type="button"
                  onClick={() => { toggleSeat(selectedSeat) }}
                  className="text-[11px] text-error hover:opacity-80 transition-opacity"
                >
                  Remove
                </button>
              </div>

              {/* Player type */}
              <div className="flex flex-wrap gap-1">
                {PLAYER_TYPE_CODES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setSeatType(selectedSeat, code)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                      selectedSeatType === code
                        ? 'bg-gold border-gold text-on-gold'
                        : 'bg-surface-overlay border-line text-ink-2 hover:border-link'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>

              {/* Stack */}
              <label className="flex items-center gap-2 text-[12px] text-ink-2">
                Stack&nbsp;$
                <input
                  type="number"
                  min={0}
                  value={selectedSeatStack}
                  onChange={(e) => setSeatStack(selectedSeat, Math.max(0, Number(e.target.value)))}
                  className="w-24 rounded bg-canvas border border-line text-ink text-[12px] px-2 py-1 outline-none focus:border-link"
                  style={{ userSelect: 'text' }}
                />
              </label>

              {/* Seat action */}
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-[12px] text-ink-2">Action</label>
                <select
                  value={value.seat_actions?.[selectedSeat]?.action ?? ''}
                  onChange={(e) => setSeatAction(selectedSeat, e.target.value === '' ? null : e.target.value as SeatAction)}
                  className="rounded bg-canvas border border-line text-ink text-[12px] px-2 py-1 outline-none focus:border-link"
                >
                  <option value="">- none -</option>
                  {SEAT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                {value.seat_actions?.[selectedSeat]?.action &&
                  ACTIONS_WITH_AMOUNT.includes(value.seat_actions[selectedSeat].action as SeatAction) && (
                  <label className="flex items-center gap-1 text-[12px] text-ink-2">
                    $
                    <input
                      type="number"
                      min={0}
                      value={value.seat_actions?.[selectedSeat]?.amount ?? ''}
                      onChange={(e) => setSeatActionAmount(selectedSeat, e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
                      placeholder="amt"
                      className="w-20 rounded bg-canvas border border-line text-ink text-[12px] px-2 py-1 outline-none focus:border-link"
                      style={{ userSelect: 'text' }}
                    />
                  </label>
                )}
              </div>

              {/* Apply - saves current seat config and closes panel */}
              <button
                type="button"
                onClick={() => setSelectedSeat(null)}
                className="w-full py-1.5 rounded-lg bg-gold text-on-gold text-[12px] font-semibold hover:opacity-90 transition-opacity"
              >
                Apply
              </button>
            </div>
          )}

          {/* Hero config - collapsed summary / expanded editor */}
          {!heroOpen ? (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-line bg-surface">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold text-ink-2 uppercase tracking-widest">Hero</span>
                <div className="flex gap-1">
                  {([0, 1] as const).map((i) =>
                    holeCards[i]
                      ? <Card key={i} card={holeCards[i] as string} />
                      : <EmptyCardSlot key={i} />
                  )}
                </div>
                {value.seat_actions?.[heroPos]?.action && (
                  <span className="text-[11px] bg-surface-overlay border border-line rounded px-2 py-0.5 text-ink">
                    {value.seat_actions[heroPos].action}
                    {value.seat_actions[heroPos].amount !== undefined
                      ? ` $${value.seat_actions[heroPos].amount}`
                      : ''}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setHeroOpen(true)}
                className="text-[11px] text-link hover:opacity-80 transition-opacity shrink-0"
              >
                Edit
              </button>
            </div>
          ) : (
            <div className="space-y-3 p-3 rounded-lg border border-gold/40 bg-surface">
              <span className="text-ink text-[13px] font-semibold">Hero - configure</span>

              {/* Hero hole cards */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-widest">
                  Hole cards
                </p>
                <div className="flex gap-2">
                  {([0, 1] as const).map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleEditSlot({ kind: 'hole', index: i })}
                      className={`rounded outline-none transition-shadow ${
                        editingSlot?.kind === 'hole' && editingSlot.index === i
                          ? 'ring-2 ring-gold'
                          : 'ring-1 ring-line hover:ring-link'
                      }`}
                    >
                      {holeCards[i] ? <Card card={holeCards[i] as string} /> : <EmptyCardSlot />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hero action */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-widest">
                  Action
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={value.seat_actions?.[heroPos]?.action ?? ''}
                    onChange={(e) => setSeatAction(heroPos, e.target.value === '' ? null : e.target.value as SeatAction)}
                    className="rounded bg-canvas border border-line text-ink text-[12px] px-2 py-1 outline-none focus:border-link"
                  >
                    <option value="">- none -</option>
                    {SEAT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  {value.seat_actions?.[heroPos]?.action &&
                    ACTIONS_WITH_AMOUNT.includes(value.seat_actions[heroPos].action as SeatAction) && (
                    <label className="flex items-center gap-1 text-[12px] text-ink-2">
                      $
                      <input
                        type="number"
                        min={0}
                        value={value.seat_actions?.[heroPos]?.amount ?? ''}
                        onChange={(e) => setSeatActionAmount(heroPos, e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
                        placeholder="amt"
                        className="w-20 rounded bg-canvas border border-line text-ink text-[12px] px-2 py-1 outline-none focus:border-link"
                        style={{ userSelect: 'text' }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Card picker */}
              {editingSlot?.kind === 'hole' && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-ink-3">
                    Hole card {editingSlot.index + 1} - click to pick, click again to clear
                  </p>
                  <CardPicker
                    value={pickerValue}
                    usedCards={usedCards}
                    onChange={handlePickerChange}
                  />
                </div>
              )}

              {/* Apply */}
              <button
                type="button"
                onClick={() => { setHeroOpen(false); setEditingSlot(null) }}
                className="w-full py-1.5 rounded-lg bg-gold text-on-gold text-[12px] font-semibold hover:opacity-90 transition-opacity"
              >
                Apply
              </button>
            </div>
          )}

          {/* Board cards (hidden for preflop) */}
          {boardSlotCount > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-widest">
                Board cards
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: boardSlotCount }, (_, i) => {
                  const enabled = i === 0 || boardCards[i - 1] !== null
                  const isEditing = editingSlot?.kind === 'board' && editingSlot.index === i
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!enabled}
                      onClick={() => enabled && toggleEditSlot({ kind: 'board', index: i })}
                      className={`rounded outline-none transition-shadow ${
                        !enabled
                          ? 'opacity-30 cursor-not-allowed'
                          : isEditing
                            ? 'ring-2 ring-gold'
                            : 'ring-1 ring-line hover:ring-link'
                      }`}
                    >
                      {boardCards[i] ? <Card card={boardCards[i] as string} /> : <EmptyCardSlot />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Board card picker */}
          {editingSlot?.kind === 'board' && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-ink-3">
                Board card {editingSlot.index + 1} - click to pick, click again to clear
              </p>
              <div className="overflow-x-auto">
                <CardPicker
                  value={pickerValue}
                  usedCards={usedCards}
                  onChange={handlePickerChange}
                />
              </div>
            </div>
          )}
        </div>

        {/* End left column */}
        </div>

        {/* -- Vertical divider (large screens only) -------------------------- */}
        {livePreviewSlot && (
          <div className="hidden lg:block self-stretch w-px bg-line" />
        )}

        {/* -- Right column: live preview (large screens only) --------------- */}
        {livePreviewSlot && (
          <div className="hidden lg:flex flex-1 min-w-0 justify-center">
            {livePreviewSlot}
          </div>
        )}

      </div>
    </div>
  )
}
