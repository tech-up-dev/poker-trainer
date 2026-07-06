import { useState } from 'react'
import type { JSX } from 'react'
import type { HandScenarioState } from '../../shared/schemas/lesson'
import { Card } from './Card'
import { CardPicker } from './CardPicker'

// ─── Constants (mirrors PokerTable) ──────────────────────────────────────────

const POSITIONS = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'MP+1', 'HJ', 'CO'] as const
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
  { style: { left: '50%', top: '91%', transform: 'translate(-50%, -50%)' }, align: 'center' },
  { style: { right: '3%', top: '80%', transform: 'translateY(-50%)' }, align: 'flex-end' },
  { style: { right: '1%', top: '50%', transform: 'translateY(-50%)' }, align: 'flex-end' },
  { style: { right: '3%', top: '19%', transform: 'translateY(-50%)' }, align: 'flex-end' },
  { style: { left: '64%', top: '3%', transform: 'translateX(-50%)' }, align: 'center' },
  { style: { left: '36%', top: '3%', transform: 'translateX(-50%)' }, align: 'center' },
  { style: { left: '3%', top: '19%', transform: 'translateY(-50%)' }, align: 'flex-start' },
  { style: { left: '1%', top: '50%', transform: 'translateY(-50%)' }, align: 'flex-start' },
  { style: { left: '3%', top: '80%', transform: 'translateY(-50%)' }, align: 'flex-start' },
]

function normalisePos(pos: string): string {
  return pos.replace(/^LJ$/i, 'HJ').toUpperCase()
}

function getSeatedPositions(heroPosition: string): string[] {
  const hero = normalisePos(heroPosition)
  const idx = (POSITIONS as readonly string[]).indexOf(hero)
  if (idx < 0) return [...POSITIONS]
  return [...POSITIONS.slice(idx), ...POSITIONS.slice(0, idx)]
}

// ─── Shared sub-components (same visual tokens as PokerTable) ─────────────────

function PosPill({
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
      <div className="inline-flex rounded-[11px] overflow-hidden border border-[#2a5079]">
        <span className="bg-[#0E2A47] text-[#EAF1F8] text-[11px] px-[7px] py-[3px] leading-none whitespace-nowrap">
          {position}
        </span>
        {stack !== undefined && (
          <span className="bg-[#16395C] text-[#EAF1F8] text-[11px] px-[8px] py-[3px] leading-none whitespace-nowrap">
            ${stack}
          </span>
        )}
      </div>
      {isBtn && (
        <div className="w-[18px] h-[18px] rounded-full bg-[#F4A024] text-[#0A1E33] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
          D
        </div>
      )}
    </div>
  )
}

function TypeBadge({ code, active }: { code: string; active: boolean }): JSX.Element {
  return (
    <div
      className={`inline-flex items-center gap-[5px] rounded-[12px] px-[9px] py-[2px] border ${
        active ? 'bg-[#F4A024] border-[#F4A024]' : 'bg-[#16395C] border-[#2a5079]'
      }`}
    >
      <span
        className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${active ? 'bg-[#0A1E33]' : 'bg-[#5DA2E0]'}`}
      />
      <span className={`text-[11px] font-medium leading-none ${active ? 'text-[#0A1E33]' : 'text-[#EAF1F8]'}`}>
        {code}
      </span>
    </div>
  )
}

function EmptyCardSlot(): JSX.Element {
  return (
    <div className="w-[30px] h-[42px] rounded border-2 border-dashed border-[#2a5079] flex items-center justify-center">
      <span className="text-[#3a5068] text-[18px] leading-none font-light">+</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface TableBuilderProps {
  value: HandScenarioState
  onChange: (state: HandScenarioState) => void
}

type EditingSlot =
  | { kind: 'hole'; index: 0 | 1 }
  | { kind: 'board'; index: number }

export function TableBuilder({ value, onChange }: TableBuilderProps): JSX.Element {
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null)
  const [editingSlot, setEditingSlot] = useState<EditingSlot | null>(null)

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

  // ─── Update helpers ────────────────────────────────────────────────────────

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

  // ─── Render ───────────────────────────────────────────────────────────────

  const selectedSeatType = selectedSeat ? (value.villain_player_types?.[selectedSeat] ?? null) : null
  const selectedSeatStack = selectedSeat ? (value.stack_sizes?.[selectedSeat] ?? 500) : 500

  return (
    <div className="space-y-4" style={{ userSelect: 'none' }}>

      {/* ── Top controls ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Street tabs */}
        <div className="flex rounded-lg overflow-hidden border border-[#2a5079]">
          {STREETS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStreet(s)}
              className={`px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${
                street === s
                  ? 'bg-[#F4A024] text-[#07182C]'
                  : 'bg-[#0E2A47] text-[#9DB2C9] hover:bg-[#16395C]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Pot */}
        <label className="flex items-center gap-1.5 text-[12px] text-[#9DB2C9]">
          Pot&nbsp;$
          <input
            type="number"
            min={0}
            value={value.pot_size ?? ''}
            onChange={(e) =>
              patch({ pot_size: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })
            }
            placeholder="0"
            className="w-20 rounded bg-[#0E2A47] border border-[#2a5079] text-[#EAF1F8] text-[12px] px-2 py-1 outline-none focus:border-[#5DA2E0]"
            style={{ userSelect: 'text' }}
          />
        </label>

        {/* Hero position */}
        <label className="flex items-center gap-1.5 text-[12px] text-[#9DB2C9]">
          Hero
          <select
            value={heroPos}
            onChange={(e) => setHeroPos(e.target.value as Position)}
            className="rounded bg-[#0E2A47] border border-[#2a5079] text-[#EAF1F8] text-[12px] px-2 py-1 outline-none focus:border-[#5DA2E0]"
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        {/* Hero stack */}
        <label className="flex items-center gap-1.5 text-[12px] text-[#9DB2C9]">
          Hero stack&nbsp;$
          <input
            type="number"
            min={0}
            value={value.stack_sizes?.[heroPos] ?? ''}
            onChange={(e) =>
              setSeatStack(heroPos, Math.max(0, Number(e.target.value)))
            }
            placeholder="500"
            className="w-20 rounded bg-[#0E2A47] border border-[#2a5079] text-[#EAF1F8] text-[12px] px-2 py-1 outline-none focus:border-[#5DA2E0]"
            style={{ userSelect: 'text' }}
          />
        </label>
      </div>

      {/* ── Main: table + config panel ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-6 items-start">

        {/* ── Interactive oval table ─────────────────────────────────────── */}
        <div className="w-full max-w-sm flex-shrink-0">
          <div className="relative w-full" style={{ height: 290 }}>

            {/* Leather rail */}
            <div
              className="absolute inset-0 rounded-[50%]"
              style={{
                background: 'linear-gradient(180deg,#7A4E2A 0%,#5E3A1F 65%)',
                boxShadow: 'inset 0 0 0 1px rgba(201,154,106,0.35)',
              }}
            />
            {/* Green felt */}
            <div
              className="absolute"
              style={{
                inset: '10px 13px',
                background: '#1C6B43',
                borderRadius: '50%',
                boxShadow: 'inset 0 0 36px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(0,0,0,0.18)',
              }}
            />

            {/* Center: pot + board preview */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-2 pointer-events-none">
              {(value.pot_size ?? 0) > 0 && (
                <div
                  className="text-[#EAF1F8] text-[12px] px-3 py-[4px] rounded-[13px] border border-[#2a5079]"
                  style={{ background: 'rgba(4,12,24,0.55)' }}
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
                  className="text-[#6B83A0] text-[10px] px-2 py-[2px] rounded uppercase tracking-widest"
                  style={{ background: 'rgba(4,12,24,0.28)' }}
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
                          border: '2px solid #F4A024',
                          boxShadow: '0 0 0 4px rgba(244,160,36,0.18)',
                        }}
                      >
                        {/* Hole card slots */}
                        <div className="flex gap-0.5">
                          {([0, 1] as const).map((i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => toggleEditSlot({ kind: 'hole', index: i })}
                              className={`rounded outline-none transition-shadow ${
                                editingSlot?.kind === 'hole' && editingSlot.index === i
                                  ? 'ring-2 ring-[#F4A024]'
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
                        <PosPill position={heroPos} stack={stack} isBtn={heroPos === 'BTN'} />
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        isActive
                          ? setSelectedSeat(isSelected ? null : pos)
                          : toggleSeat(pos)
                      }
                      className="flex flex-col gap-[4px] cursor-pointer transition-opacity"
                      style={{ alignItems: slot.align, minWidth: 44, minHeight: 44 }}
                      aria-label={
                        isActive
                          ? `${typeCode ?? ''} at ${pos}, tap to configure`
                          : `Empty seat ${pos}, tap to add villain`
                      }
                    >
                      {isActive && typeCode && <TypeBadge code={typeCode} active={isSelected} />}
                      <PosPill position={pos} stack={isActive ? stack : undefined} isBtn={pos === 'BTN'} />
                      {!isActive && (
                        <span className="text-[#3a5068] text-[10px] leading-none">+ add</span>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right config panel ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-[280px] space-y-5">

          {/* Villain seat config */}
          {selectedSeat && selectedSeatType && (
            <div className="space-y-3 p-3 rounded-lg border border-[#2a5079] bg-[#0E2A47]">
              <div className="flex items-center justify-between">
                <span className="text-[#EAF1F8] text-[13px] font-semibold">{selectedSeat}</span>
                <button
                  type="button"
                  onClick={() => toggleSeat(selectedSeat)}
                  className="text-[11px] text-[#D6483B] hover:text-red-400 transition-colors"
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
                        ? 'bg-[#F4A024] border-[#F4A024] text-[#07182C]'
                        : 'bg-[#16395C] border-[#2a5079] text-[#9DB2C9] hover:border-[#5DA2E0]'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>

              {/* Stack */}
              <label className="flex items-center gap-2 text-[12px] text-[#9DB2C9]">
                Stack&nbsp;$
                <input
                  type="number"
                  min={0}
                  value={selectedSeatStack}
                  onChange={(e) => setSeatStack(selectedSeat, Math.max(0, Number(e.target.value)))}
                  className="w-24 rounded bg-[#07182C] border border-[#2a5079] text-[#EAF1F8] text-[12px] px-2 py-1 outline-none focus:border-[#5DA2E0]"
                  style={{ userSelect: 'text' }}
                />
              </label>

              {/* Seat action */}
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-[12px] text-[#9DB2C9]">Action</label>
                <select
                  value={value.seat_actions?.[selectedSeat]?.action ?? ''}
                  onChange={(e) => setSeatAction(selectedSeat, e.target.value === '' ? null : e.target.value as SeatAction)}
                  className="rounded bg-[#07182C] border border-[#2a5079] text-[#EAF1F8] text-[12px] px-2 py-1 outline-none focus:border-[#5DA2E0]"
                >
                  <option value="">- none -</option>
                  {SEAT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                {value.seat_actions?.[selectedSeat]?.action &&
                  ACTIONS_WITH_AMOUNT.includes(value.seat_actions[selectedSeat].action as SeatAction) && (
                  <label className="flex items-center gap-1 text-[12px] text-[#9DB2C9]">
                    $
                    <input
                      type="number"
                      min={0}
                      value={value.seat_actions?.[selectedSeat]?.amount ?? ''}
                      onChange={(e) => setSeatActionAmount(selectedSeat, e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
                      placeholder="amt"
                      className="w-20 rounded bg-[#07182C] border border-[#2a5079] text-[#EAF1F8] text-[12px] px-2 py-1 outline-none focus:border-[#5DA2E0]"
                      style={{ userSelect: 'text' }}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Hero hole cards */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-[#9DB2C9] uppercase tracking-widest">
              Hero hole cards
            </p>
            <div className="flex gap-2">
              {([0, 1] as const).map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleEditSlot({ kind: 'hole', index: i })}
                  className={`rounded outline-none transition-shadow ${
                    editingSlot?.kind === 'hole' && editingSlot.index === i
                      ? 'ring-2 ring-[#F4A024]'
                      : 'ring-1 ring-[#2a5079] hover:ring-[#5DA2E0]'
                  }`}
                >
                  {holeCards[i] ? <Card card={holeCards[i] as string} /> : <EmptyCardSlot />}
                </button>
              ))}
            </div>
          </div>

          {/* Hero action */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-[#9DB2C9] uppercase tracking-widest">
              Hero action
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={value.seat_actions?.[heroPos]?.action ?? ''}
                onChange={(e) => setSeatAction(heroPos, e.target.value === '' ? null : e.target.value as SeatAction)}
                className="rounded bg-[#0E2A47] border border-[#2a5079] text-[#EAF1F8] text-[12px] px-2 py-1 outline-none focus:border-[#5DA2E0]"
              >
                <option value="">- none -</option>
                {SEAT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              {value.seat_actions?.[heroPos]?.action &&
                ACTIONS_WITH_AMOUNT.includes(value.seat_actions[heroPos].action as SeatAction) && (
                <label className="flex items-center gap-1 text-[12px] text-[#9DB2C9]">
                  $
                  <input
                    type="number"
                    min={0}
                    value={value.seat_actions?.[heroPos]?.amount ?? ''}
                    onChange={(e) => setSeatActionAmount(heroPos, e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
                    placeholder="amt"
                    className="w-20 rounded bg-[#0E2A47] border border-[#2a5079] text-[#EAF1F8] text-[12px] px-2 py-1 outline-none focus:border-[#5DA2E0]"
                    style={{ userSelect: 'text' }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Board cards (hidden for preflop) */}
          {boardSlotCount > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-[#9DB2C9] uppercase tracking-widest">
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
                            ? 'ring-2 ring-[#F4A024]'
                            : 'ring-1 ring-[#2a5079] hover:ring-[#5DA2E0]'
                      }`}
                    >
                      {boardCards[i] ? <Card card={boardCards[i] as string} /> : <EmptyCardSlot />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Card picker - shown only when a slot is active */}
          {editingSlot && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-[#6B83A0]">
                {editingSlot.kind === 'hole'
                  ? `Hole card ${editingSlot.index + 1} - click to pick, click again to clear`
                  : `Board card ${editingSlot.index + 1} - click to pick, click again to clear`}
              </p>
              <CardPicker
                value={pickerValue}
                usedCards={usedCards}
                onChange={handlePickerChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
