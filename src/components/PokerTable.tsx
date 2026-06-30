import { useState } from 'react';
import type { JSX } from 'react';
import type { HandScenarioState } from '../../shared/schemas/lesson';
import { Card, CardBack } from './Card';

// ─── Position data ───────────────────────────────────────────────────────────

const POSITIONS = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'MP+1', 'HJ', 'CO'] as const;
type Position = (typeof POSITIONS)[number];

// Normalise non-standard aliases
function normalisePos(pos: string): string {
  return pos.replace(/^LJ$/i, 'HJ').toUpperCase();
}

// Rotate the position ring so the hero is always at slot 0 (bottom-center)
function getSeatedPositions(heroPosition: string): string[] {
  const hero = normalisePos(heroPosition);
  const idx = (POSITIONS as readonly string[]).indexOf(hero);
  if (idx < 0) return [...POSITIONS];
  return [...POSITIONS.slice(idx), ...POSITIONS.slice(0, idx)];
}

// ─── Visual slot layout (clockwise from bottom-center) ───────────────────────
// Each slot has CSS style + flex-alignment for inward-facing content

type Align = 'center' | 'flex-start' | 'flex-end';

interface Slot {
  style: React.CSSProperties;
  align: Align;
}

const SLOTS: Slot[] = [
  // 0 – bottom-center (hero)
  { style: { left: '50%', top: '91%', transform: 'translate(-50%, -50%)' }, align: 'center' },
  // 1 – bottom-right
  { style: { right: '3%', top: '80%', transform: 'translateY(-50%)' }, align: 'flex-end' },
  // 2 – right
  { style: { right: '1%', top: '50%', transform: 'translateY(-50%)' }, align: 'flex-end' },
  // 3 – top-right
  { style: { right: '3%', top: '19%', transform: 'translateY(-50%)' }, align: 'flex-end' },
  // 4 – top-center-right
  { style: { left: '64%', top: '3%', transform: 'translateX(-50%)' }, align: 'center' },
  // 5 – top-center-left
  { style: { left: '36%', top: '3%', transform: 'translateX(-50%)' }, align: 'center' },
  // 6 – top-left
  { style: { left: '3%', top: '19%', transform: 'translateY(-50%)' }, align: 'flex-start' },
  // 7 – left
  { style: { left: '1%', top: '50%', transform: 'translateY(-50%)' }, align: 'flex-start' },
  // 8 – bottom-left
  { style: { left: '3%', top: '80%', transform: 'translateY(-50%)' }, align: 'flex-start' },
];

// ─── Player type encyclopedia ────────────────────────────────────────────────

interface PlayerTypeInfo {
  name: string;
  desc: string;
  tags: string[];
}

const PLAYER_TYPES: Record<string, PlayerTypeInfo> = {
  OMC: {
    name: 'Old Man Coffee',
    desc: 'Tight and passive. Opens a very narrow range, never bluffs, can be bluffed when scare cards hit. When an OMC bets big, he has it.',
    tags: ['Tight', 'Passive', 'Fit or Fold'],
  },
  PLF: {
    name: 'Passive Loose Fish',
    desc: "Calling station. Calls far too wide and chases everything, but won't play back at you unless he makes his hand. Value bet relentlessly, don't over-bluff.",
    tags: ['Loose', 'Passive', 'Calls too wide'],
  },
  Y2K: {
    name: 'Y2K TAG',
    desc: 'Plays tight and straightforward. Only 3-bets monsters. Can be bluffed on scary boards. Pressure them on later streets — they rarely call down light.',
    tags: ['Old-school TAG', 'Predictable', 'Folds to pressure'],
  },
  GTO: {
    name: 'GTO Boy',
    desc: 'Solver-trained and aggressive. Tries to stay balanced, can be tricky. Use check-raises, check back strong hands, overbet with monsters, show bluffs.',
    tags: ['Aggressive', 'Balanced', 'Solver-trained'],
  },
  DWM: {
    name: 'Drunk Whale Maniac',
    desc: 'Loose, aggressive, and spewy. Can raise or bluff with any two cards. Stay aggressive against him — your big hands will get paid off.',
    tags: ['Gambler', 'Over-bluffs', 'Spews chips'],
  },
  STP: {
    name: 'Smart Thinking Player',
    desc: "Our toughest opponent. Pays attention, adapts, capable of light 3-betting. Mix up your lines, look for small leaks, don't over-bluff.",
    tags: ['Adaptive', 'Balanced', 'Tough'],
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function PositionStackPill({
  position,
  stack,
  isBtn,
}: {
  position: string;
  stack?: number;
  isBtn: boolean;
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
  );
}

function TypeCodeBadge({ code }: { code: string }): JSX.Element {
  return (
    <div className="inline-flex items-center gap-[5px] bg-[#16395C] border border-[#2a5079] rounded-[12px] px-[9px] py-[2px]">
      <span className="w-[6px] h-[6px] rounded-full bg-[#5DA2E0] flex-shrink-0" />
      <span className="text-[#EAF1F8] text-[11px] font-medium leading-none">{code}</span>
    </div>
  );
}

function ActionChip({ action, amount }: { action: string; amount?: number }): JSX.Element {
  return (
    <div className="inline-flex items-center bg-[#0E2A47] border border-[#2a5079] rounded-[11px] px-[9px] py-[3px]">
      <span className="text-[#EAF1F8] text-[11px] leading-none whitespace-nowrap">
        {action}
        {amount !== undefined && (
          <>
            {' '}
            <span className="text-[#F4A024]">${amount}</span>
          </>
        )}
      </span>
    </div>
  );
}

// ─── Seat display ─────────────────────────────────────────────────────────────

type SeatRole = 'hero' | 'focus' | 'background';
type SeatActionEntry = { action: string; amount?: number };

interface SeatDisplayProps {
  position: string;
  role: SeatRole;
  folded: boolean;
  stack?: number;
  typeCode?: string;
  holeCards?: string[];
  action?: SeatActionEntry;
  isBtn: boolean;
  align: Align;
  onTap?: () => void;
}

function SeatDisplay({
  position,
  role,
  folded,
  stack,
  typeCode,
  holeCards,
  action,
  isBtn,
  align,
  onTap,
}: SeatDisplayProps): JSX.Element {
  const dimmed = folded && role !== 'hero';

  const pill = <PositionStackPill position={position} stack={stack} isBtn={isBtn} />;

  if (role === 'hero') {
    return (
      <div className="flex flex-col items-center gap-[4px]">
        {action && <ActionChip action={action.action} amount={action.amount} />}
        <div
          className="flex flex-col items-center gap-[5px] p-[5px] rounded-[14px]"
          style={{
            border: '2px solid #F4A024',
            boxShadow: '0 0 0 4px rgba(244,160,36,0.18)',
          }}
        >
          {holeCards && holeCards.length > 0 && (
            <div className="flex">
              <div style={{ transform: 'rotate(-5deg)' }}>
                <Card card={holeCards[0]} />
              </div>
              {holeCards[1] && (
                <div style={{ transform: 'rotate(5deg)', marginLeft: -8 }}>
                  <Card card={holeCards[1]} />
                </div>
              )}
            </div>
          )}
          {pill}
        </div>
      </div>
    );
  }

  if (role === 'focus') {
    return (
      <button
        className={`flex flex-col gap-[4px] cursor-pointer transition-opacity ${dimmed ? 'opacity-40' : ''}`}
        style={{ alignItems: align, minWidth: 44, minHeight: 44 }}
        onClick={onTap}
        aria-label={`${typeCode ?? ''} at ${position} — tap for player info`}
      >
        <div className="flex">
          <CardBack />
          <div style={{ marginLeft: -7 }}>
            <CardBack />
          </div>
        </div>
        {typeCode && <TypeCodeBadge code={typeCode} />}
        {pill}
        {action && !folded && <ActionChip action={action.action} amount={action.amount} />}
      </button>
    );
  }

  // background
  return (
    <div
      className={`flex flex-col gap-[4px] transition-opacity ${dimmed ? 'opacity-40' : ''}`}
      style={{ alignItems: align }}
    >
      {pill}
    </div>
  );
}

// ─── Scout drawer (player-type explainer) ────────────────────────────────────

function ScoutDrawer({
  typeCode,
  info,
  onClose,
}: {
  typeCode: string;
  info: PlayerTypeInfo;
  onClose: () => void;
}): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(7,24,44,0.82)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl p-5 pb-8"
        style={{ background: '#0E2A47', border: '1px solid #21466B' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <TypeCodeBadge code={typeCode} />
          <span className="text-[#EAF1F8] font-semibold text-[15px]">{info.name}</span>
        </div>
        <p className="text-[#9DB2C9] text-[13.5px] leading-relaxed mb-4">{info.desc}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {info.tags.map((t) => (
            <span
              key={t}
              className="text-[#9DB2C9] text-[12px] bg-[#16395C] rounded-xl px-3 py-1"
            >
              {t}
            </span>
          ))}
        </div>
        <button
          className="w-full rounded-[10px] py-3 text-[#0A1E33] font-semibold text-[14px]"
          style={{ background: '#F4A024' }}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PokerTableProps {
  tableState: HandScenarioState;
}

export function PokerTable({ tableState }: PokerTableProps): JSX.Element {
  const [scoutPosition, setScoutPosition] = useState<string | null>(null);

  const {
    street,
    hero_position,
    hero_hole_cards,
    board_cards,
    pot_size,
    stack_sizes,
    villain_player_types,
    seat_actions,
  } = tableState;

  const heroPos = normalisePos(hero_position);
  const seatedPositions = getSeatedPositions(hero_position);

  function getSeatRole(pos: string): SeatRole {
    if (normalisePos(pos) === heroPos) return 'hero';
    if (villain_player_types?.[pos]) return 'focus';
    return 'background';
  }

  const scoutTypeCode =
    scoutPosition ? (villain_player_types?.[scoutPosition] ?? null) : null;
  const scoutInfo = scoutTypeCode ? PLAYER_TYPES[scoutTypeCode] : null;

  return (
    <div className="w-full max-w-sm mx-auto" style={{ userSelect: 'none' }}>
      {/* Oval table */}
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
            boxShadow:
              'inset 0 0 36px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(0,0,0,0.18)',
          }}
        />

        {/* Pot + board cards (center) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-2 pointer-events-none">
          {pot_size !== undefined && pot_size > 0 && (
            <div
              className="text-[#EAF1F8] text-[12px] px-3 py-[4px] rounded-[13px] border border-[#2a5079]"
              style={{ background: 'rgba(4,12,24,0.55)' }}
            >
              Pot <strong className="font-semibold">${pot_size}</strong>
            </div>
          )}
          {board_cards && board_cards.length > 0 && (
            <div className="flex gap-[3px]">
              {board_cards.slice(0, 5).map((c, i) => (
                <Card key={i} card={c} size="sm" />
              ))}
            </div>
          )}
          {street === 'preflop' && (!board_cards || board_cards.length === 0) && (
            <div
              className="text-[#6B83A0] text-[10px] px-2 py-[2px] rounded uppercase tracking-widest"
              style={{ background: 'rgba(4,12,24,0.28)' }}
            >
              Preflop
            </div>
          )}
        </div>

        {/* 9 seats */}
        {seatedPositions.map((pos, slotIdx) => {
          const slot = SLOTS[slotIdx];
          const role = getSeatRole(pos);
          const action = seat_actions?.[pos];
          const folded = action?.action === 'Fold';

          return (
            <div
              key={pos}
              className="absolute z-20"
              style={slot.style}
            >
              <SeatDisplay
                position={pos}
                role={role}
                folded={folded}
                stack={stack_sizes?.[pos]}
                typeCode={villain_player_types?.[pos]}
                holeCards={role === 'hero' ? hero_hole_cards : undefined}
                action={action}
                isBtn={pos === 'BTN'}
                align={slot.align}
                onTap={role === 'focus' ? () => setScoutPosition(pos) : undefined}
              />
            </div>
          );
        })}
      </div>

      {/* Scout drawer */}
      {scoutPosition && scoutInfo && scoutTypeCode && (
        <ScoutDrawer
          typeCode={scoutTypeCode}
          info={scoutInfo}
          onClose={() => setScoutPosition(null)}
        />
      )}
    </div>
  );
}
