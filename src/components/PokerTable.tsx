import { useState } from 'react';
import type { JSX } from 'react';
import type { HandScenarioState } from '../../shared/schemas/lesson';
import { Card } from './Card';

// ─── Position data ───────────────────────────────────────────────────────────

const POSITIONS = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'] as const;

function normalisePos(pos: string): string {
  return pos
    .replace(/^MP\+1$/i, 'LJ')
    .replace(/^MP$/i, 'UTG+2')
    .toUpperCase();
}

function getSeatedPositions(heroPosition: string): string[] {
  const hero = normalisePos(heroPosition);
  const idx = (POSITIONS as readonly string[]).indexOf(hero);
  if (idx < 0) return [...POSITIONS];
  return [...POSITIONS.slice(idx), ...POSITIONS.slice(0, idx)];
}

// ─── Visual slot layout (clockwise from bottom-center) ───────────────────────

type Align = 'center' | 'flex-start' | 'flex-end';

interface Slot {
  style: React.CSSProperties;
  align: Align;
}

const SLOTS: Slot[] = [
  // 0 – bottom-center (hero)
  { style: { left: '50%', top: '90%', transform: 'translate(-50%, -50%)' }, align: 'center' },
  // 1 – bottom-right
  { style: { right: '2%', top: '72%', transform: 'translateY(-50%)' }, align: 'flex-end' },
  // 2 – right
  { style: { right: '2%', top: '50%', transform: 'translateY(-50%)' }, align: 'flex-end' },
  // 3 – top-right
  { style: { right: '2%', top: '28%', transform: 'translateY(-50%)' }, align: 'flex-end' },
  // 4 – top-center-right (pushed outward to avoid pill collision with slot 5)
  { style: { left: '65%', top: '6%', transform: 'translateX(-50%)' }, align: 'center' },
  // 5 – top-center-left (pushed outward to avoid pill collision with slot 4)
  { style: { left: '35%', top: '6%', transform: 'translateX(-50%)' }, align: 'center' },
  // 6 – top-left
  { style: { left: '2%', top: '28%', transform: 'translateY(-50%)' }, align: 'flex-start' },
  // 7 – left
  { style: { left: '2%', top: '50%', transform: 'translateY(-50%)' }, align: 'flex-start' },
  // 8 – bottom-left
  { style: { left: '2%', top: '72%', transform: 'translateY(-50%)' }, align: 'flex-start' },
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
    desc: 'Plays tight and straightforward. Only 3-bets monsters. Can be bluffed on scary boards. Pressure them on later streets, they rarely call down light.',
    tags: ['Old-school TAG', 'Predictable', 'Folds to pressure'],
  },
  GTO: {
    name: 'GTO Boy',
    desc: 'Solver-trained and aggressive. Tries to stay balanced, can be tricky. Use check-raises, check back strong hands, overbet with monsters, show bluffs.',
    tags: ['Aggressive', 'Balanced', 'Solver-trained'],
  },
  DWM: {
    name: 'Drunk Whale Maniac',
    desc: 'Loose, aggressive, and spewy. Can raise or bluff with any two cards. Stay aggressive against him, your big hands will get paid off.',
    tags: ['Gambler', 'Over-bluffs', 'Spews chips'],
  },
  STP: {
    name: 'Smart Thinking Player',
    desc: "Our toughest opponent. Pays attention, adapts, capable of light 3-betting. Mix up your lines, look for small leaks, don't over-bluff.",
    tags: ['Adaptive', 'Balanced', 'Tough'],
  },
};

// ─── Shared sub-components ────────────────────────────────────────────────────

// Two tiny overlapping face-down cards — shown above every active villain seat
function MiniCards(): JSX.Element {
  const cardStyle: React.CSSProperties = {
    width: 14,
    height: 20,
    borderRadius: 3,
    border: '1px solid rgba(42,80,121,0.8)',
    background: 'repeating-linear-gradient(45deg,#1b4068,#1b4068 2px,#16395C 2px,#16395C 4px)',
    flexShrink: 0,
  };
  return (
    <div className="flex items-end" style={{ marginBottom: 2 }}>
      <div style={{ ...cardStyle, transform: 'rotate(-6deg)', zIndex: 1 }} />
      <div style={{ ...cardStyle, transform: 'rotate(6deg)', marginLeft: -5, zIndex: 2 }} />
    </div>
  );
}

// Full pill for hero — position + stack side-by-side, more spacious
function HeroPill({
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
  );
}

// Compact pill for villain/background seats — position label only (narrow)
// Stack shown as separate small text below to avoid adjacent seat overlap
function SeatPill({
  position,
  isBtn,
}: {
  position: string;
  isBtn: boolean;
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
  );
}

function TypeCodeBadge({ code }: { code: string }): JSX.Element {
  return (
    <div className="inline-flex items-center gap-[5px] bg-surface-overlay border border-line rounded-[12px] px-[9px] py-[2px]">
      <span className="w-[6px] h-[6px] rounded-full bg-link flex-shrink-0" />
      <span className="text-ink text-[11px] font-medium leading-none">{code}</span>
    </div>
  );
}

function ActionChip({ action, amount }: { action: string; amount?: number }): JSX.Element {
  return (
    <div className="inline-flex items-center bg-surface border border-line rounded-[11px] px-[7px] py-[2px]">
      <span className="text-ink text-[10px] leading-none whitespace-nowrap">
        {action}
        {amount !== undefined && (
          <> <span className="text-gold">${amount}</span></>
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

  // ── Hero ──────────────────────────────────────────────────────────────────
  if (role === 'hero') {
    return (
      <div className="flex flex-col items-center gap-[4px]">
        {action && <ActionChip action={action.action} amount={action.amount} />}
        <div
          className="flex flex-col items-center gap-[5px] p-[5px] rounded-[14px]"
          style={{
            border: '2px solid var(--color-gold)',
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
          <HeroPill position={position} stack={stack} isBtn={isBtn} />
        </div>
      </div>
    );
  }

  // ── Villain (has player type assigned) ────────────────────────────────────
  // Compact layout: mini cards → narrow position pill → stack text → action chip
  if (role === 'focus') {
    return (
      <button
        className={`flex flex-col gap-[2px] cursor-pointer transition-opacity ${dimmed ? 'opacity-40' : ''}`}
        style={{ alignItems: align, minWidth: 44, minHeight: 44 }}
        onClick={onTap}
        aria-label={`${typeCode ?? ''} at ${position}, tap for player info`}
      >
        <MiniCards />
        <SeatPill position={position} isBtn={isBtn} />
        {stack !== undefined && (
          <span className="text-[9px] text-ink-2 leading-none">${stack}</span>
        )}
        {action && !folded && <ActionChip action={action.action} amount={action.amount} />}
      </button>
    );
  }

  // ── Background (seat present, no villain assigned) ────────────────────────
  return (
    <div
      className={`flex flex-col gap-[2px] transition-opacity ${dimmed ? 'opacity-40' : ''}`}
      style={{ alignItems: align }}
    >
      <SeatPill position={position} isBtn={isBtn} />
      {stack !== undefined && (
        <span className="text-[9px] text-ink-2 leading-none">${stack}</span>
      )}
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-canvas/80"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl p-5 pb-8 bg-surface border border-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <TypeCodeBadge code={typeCode} />
          <span className="text-ink font-semibold text-[15px]">{info.name}</span>
        </div>
        <p className="text-ink-2 text-[13.5px] leading-relaxed mb-4">{info.desc}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {info.tags.map((t) => (
            <span key={t} className="text-ink-2 text-[12px] bg-surface-overlay rounded-xl px-3 py-1">
              {t}
            </span>
          ))}
        </div>
        <button
          className="w-full rounded-[10px] py-3 bg-gold text-on-gold font-semibold text-[14px]"
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
  size?: 'sm' | 'md';
}

export function PokerTable({ tableState, size = 'md' }: PokerTableProps): JSX.Element {
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

  const scoutTypeCode = scoutPosition ? (villain_player_types?.[scoutPosition] ?? null) : null;
  const scoutInfo = scoutTypeCode ? PLAYER_TYPES[scoutTypeCode] : null;

  const isSm = size === 'sm';

  return (
    <div
      className="w-full mx-auto pb-6"
      style={{ userSelect: 'none', maxWidth: isSm ? 240 : 300 }}
    >
      {/* Oval table */}
      <div className="relative w-full" style={{ height: isSm ? 360 : 450 }}>
        {/* Leather rail — decorative real-world color */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(180deg,#7A4E2A 0%,#5E3A1F 65%)',
            boxShadow: 'inset 0 0 0 1px rgba(201,154,106,0.35)',
          }}
        />
        {/* Green felt — decorative real-world color */}
        <div
          className="absolute rounded-full"
          style={{
            inset: '12px 10px',
            background: '#1C6B43',
            boxShadow: 'inset 0 0 36px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(0,0,0,0.18)',
          }}
        />

        {/* Pot + board cards (center) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-2 pointer-events-none">
          {pot_size !== undefined && pot_size > 0 && (
            <div className="text-ink text-[12px] px-3 py-[4px] rounded-[13px] border border-line bg-canvas/60">
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
            <div className="text-ink-3 text-[10px] px-2 py-[2px] rounded uppercase tracking-widest bg-canvas/30">
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
            <div key={pos} className="absolute z-20" style={slot.style}>
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
