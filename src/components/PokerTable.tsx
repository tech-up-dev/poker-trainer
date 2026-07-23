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

// Slots run clockwise from hero (slot 0 = bottom-center). In poker, action
// flows clockwise: BTN → SB (left of BTN) → BB → UTG → … → CO (right of BTN).
const SLOTS: Slot[] = [
  // 0 – bottom-center (hero / BTN)
  { style: { left: '50%', top: '90%', transform: 'translate(-50%, -50%)' }, align: 'center' },
  // 1 – bottom-left  (SB)
  { style: { left: '2%', top: '72%', transform: 'translate(-32px, -50%)' }, align: 'center' },
  // 2 – left         (BB)
  { style: { left: '2%', top: '50%', transform: 'translate(-32px, -50%)' }, align: 'center' },
  // 3 – top-left     (UTG)
  { style: { left: '2%', top: '28%', transform: 'translate(-32px, -50%)' }, align: 'center' },
  // 4 – top-center-left  (UTG+1)
  { style: { left: '33%', top: 'calc(2% - 20px)', transform: 'translateX(-50%)' }, align: 'center' },
  // 5 – top-center-right (UTG+2)
  { style: { left: '67%', top: 'calc(2% - 20px)', transform: 'translateX(-50%)' }, align: 'center' },
  // 6 – top-right    (LJ)
  { style: { right: '2%', top: '28%', transform: 'translate(32px, -50%)' }, align: 'center' },
  // 7 – right        (HJ)
  { style: { right: '2%', top: '50%', transform: 'translate(32px, -50%)' }, align: 'center' },
  // 8 – bottom-right (CO)
  { style: { right: '2%', top: '72%', transform: 'translate(32px, -50%)' }, align: 'center' },
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

// ─── Pod spec constants ───────────────────────────────────────────────────────
// All values match the approved player_pod_spec.html exactly.

const C = {
  canvas:       '#132C40',
  posBg:        '#22384C',
  posText:      '#CFE0EE',
  typeBg:       '#2456C6',
  typeText:     '#FFFFFF',
  stackBg:      '#0F2233',
  stackText:    '#7FD8A8',
  actionBg:     '#EF9430',
  actionText:   '#3A2600',
  dealerBg:     '#E8912A',
  cardbackBg:   '#1E3E8C',
  cardbackBorder:'#5B93D6',
  seatBg:       '#22384C',
  seatText:     '#8FA8BC',
} as const;

// ─── Shared sub-components ────────────────────────────────────────────────────

// Two overlapping card backs per spec (22×32px, crosshatch pattern).
// Positioned absolutely inside the pod wrapper so they sit behind the identity block.
function PodCardBacks(): JSX.Element {
  const back: React.CSSProperties = {
    width: 17, height: 28, borderRadius: 4,
    border: `2px solid ${C.cardbackBorder}`,
    backgroundColor: C.cardbackBg,
    backgroundImage: [
      'repeating-linear-gradient(45deg,rgba(255,255,255,.16) 0 1px,transparent 1px 5px)',
      'repeating-linear-gradient(-45deg,rgba(255,255,255,.16) 0 1px,transparent 1px 5px)',
    ].join(','),
    flexShrink: 0,
  };
  return (
    <div style={{ position: 'absolute', left: '50%', top: 10, transform: 'translateX(-50%)', zIndex: 0, display: 'flex' }}>
      <div style={back} />
      <div style={{ ...back, marginLeft: -8 }} />
    </div>
  );
}

// Hero hole cards sit higher (top:-16px) and have a gap between them.
function PodHeroCards({ cards }: { cards: string[] }): JSX.Element {
  return (
    <div style={{ position: 'absolute', left: '50%', top: -16, transform: 'translateX(-50%)', zIndex: 0, display: 'flex', gap: 4 }}>
      {cards.slice(0, 2).map((c, i) => (
        <Card key={i} card={c} />
      ))}
    </div>
  );
}

// Three-segment identity block: [pos | type] on top row, stack full-width below.
function PodIdentityBlock({
  position,
  typeCode,
  stack,
  squareBottom = false,
}: {
  position: string;
  typeCode?: string;
  stack?: number;
  squareBottom?: boolean;
}): JSX.Element {
  const borderRadius = squareBottom ? '11px 11px 0 0' : 11;
  return (
    <div style={{ position: 'relative', zIndex: 1, borderRadius, overflow: 'hidden', fontSize: 10, fontWeight: 500, lineHeight: 1.15 }}>
      <div style={{ display: 'flex' }}>
        <span style={{ background: C.posBg, color: C.posText, padding: '3px 6px', flex: 1, textAlign: 'center' }}>
          {position}
        </span>
        {typeCode && (
          <span style={{ background: C.typeBg, color: C.typeText, padding: '3px 6px', flex: 1, textAlign: 'center' }}>
            {typeCode}
          </span>
        )}
      </div>
      {stack !== undefined && (
        <div style={{ background: C.stackBg, color: C.stackText, padding: '3px 0 8px', textAlign: 'center' }}>
          ${stack.toLocaleString()}
        </div>
      )}
    </div>
  );
}

// Orange action tag that overlaps the bottom of the identity block.
// Pass flush=true to sit directly below (no overlap) when there is no stack row above.
function PodActionTag({ action, amount, flush = false }: { action: string; amount?: number; flush?: boolean }): JSX.Element {
  return (
    <div style={{ position: 'relative', zIndex: 2, marginTop: flush ? -6 : -11, textAlign: 'center' }}>
      <span style={{
        display: 'inline-block',
        background: C.actionBg,
        color: C.actionText,
        fontSize: 10,
        fontWeight: 500,
        padding: '3px 14px',
        borderRadius: 999,
        lineHeight: 1.15,
        boxShadow: `0 0 0 2px ${C.canvas}`,
        whiteSpace: 'nowrap',
      }}>
        {action}{amount !== undefined ? ` $${amount}` : ''}
      </span>
    </div>
  );
}

// Dealer button: floating gold chip, absolute so it never gets clipped by identity block.
function PodDealerButton(): JSX.Element {
  return (
    <div style={{
      position: 'absolute', zIndex: 3,
      right: -14, top: 34,
      width: 22, height: 22, borderRadius: '50%',
      background: C.dealerBg, color: C.actionText,
      fontSize: 11, fontWeight: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 0 0 2px ${C.canvas}`,
    }}>D</div>
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
  onTap,
}: SeatDisplayProps): JSX.Element {
  const dimmed = folded && role !== 'hero';

  // ── Hero (132px pod, face-up hole cards, larger text) ─────────────────────
  if (role === 'hero') {
    const hasCards = holeCards && holeCards.length > 0;
    return (
      <div style={{ position: 'relative', paddingTop: 30, opacity: dimmed ? 0.4 : 1 }}>
        {isBtn && <PodDealerButton />}
        {hasCards && <PodHeroCards cards={holeCards} />}
        <PodIdentityBlock position={position} typeCode="STP" stack={stack} squareBottom={Boolean(action)} />
        {action && <PodActionTag action={action.action} amount={action.amount} flush={stack === undefined} />}
      </div>
    );
  }

  // ── Villain / focus (112px pod, card backs, clickable) ───────────────────
  if (role === 'focus') {
    return (
      <button
        type="button"
        onClick={onTap}
        aria-label={`${typeCode ?? ''} at ${position}, tap for player info`}
        style={{ position: 'relative', paddingTop: 30, paddingBottom: 0, paddingLeft: 0, paddingRight: 0, opacity: dimmed ? 0.4 : 1, cursor: 'pointer', background: 'none', border: 'none' }}
      >
        {isBtn && <PodDealerButton />}
        <PodCardBacks />
        <PodIdentityBlock position={position} typeCode={typeCode} stack={stack} />
        {action && !folded && <PodActionTag action={action.action} amount={action.amount} />}
      </button>
    );
  }

  // ── Background / empty seat - single faint pill, no cards, no action ──────
  return (
    <span style={{
      background: C.seatBg, color: C.seatText,
      font: '500 12px system-ui',
      padding: '4px 11px',
      borderRadius: 999,
      whiteSpace: 'nowrap',
      opacity: dimmed ? 0.4 : 1,
      display: 'inline-block',
    }}>
      {position}
    </span>
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
      <div className="relative w-full" style={{ height: isSm ? 380 : 470 }}>
        {/* Leather rail - decorative real-world color */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(180deg,#7A4E2A 0%,#5E3A1F 65%)',
            boxShadow: 'inset 0 0 0 1px rgba(201,154,106,0.35)',
          }}
        />
        {/* Green felt - decorative real-world color */}
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

          // Top-two seats (slots 4 & 5) drift up when empty because the card
          // backs that normally anchor them visually aren't shown. Nudge them
          // down 20px until at least a player type or stack is configured.
          const isTopSeat = slotIdx === 4 || slotIdx === 5;
          const hasValue = Boolean(villain_player_types?.[pos] || stack_sizes?.[pos]);
          const seatStyle = isTopSeat && !hasValue
            ? { ...slot.style, top: `calc(${slot.style.top} + 20px)` }
            : slot.style;

          return (
            <div key={pos} className="absolute z-20" style={seatStyle}>
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
