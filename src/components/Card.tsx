import type { JSX } from 'react';

const SUITS: Record<string, { symbol: string; red: boolean }> = {
  h: { symbol: '♥', red: true },
  d: { symbol: '♦', red: true },
  s: { symbol: '♠', red: false },
  c: { symbol: '♣', red: false },
};

interface CardProps {
  card: string;
  size?: 'sm' | 'md';
}

export function Card({ card, size = 'md' }: CardProps): JSX.Element {
  const rank = card.slice(0, -1).toUpperCase();
  const suitChar = card.slice(-1).toLowerCase();
  const suit = SUITS[suitChar] ?? { symbol: suitChar.toUpperCase(), red: false };
  const displayRank = rank === 'T' ? '10' : rank;
  const isSmall = size === 'sm';

  return (
    <div
      className={`flex flex-col items-center justify-center bg-[#F2F4F8] border border-[#c9d2dd] rounded select-none ${
        isSmall ? 'w-[22px] h-[30px]' : 'w-[30px] h-[42px]'
      }`}
    >
      <span
        className={`font-bold leading-none ${suit.red ? 'text-[#D6483B]' : 'text-[#1a2530]'} ${
          isSmall ? 'text-[10px]' : 'text-[14px]'
        }`}
      >
        {displayRank}
      </span>
      <span
        className={`leading-none ${suit.red ? 'text-[#D6483B]' : 'text-[#1a2530]'} ${
          isSmall ? 'text-[8px]' : 'text-[11px]'
        }`}
      >
        {suit.symbol}
      </span>
    </div>
  );
}

export function CardBack({ size = 'md' }: { size?: 'sm' | 'md' }): JSX.Element {
  const isSmall = size === 'sm';
  return (
    <div
      className={`rounded border border-[#2a5079] ${isSmall ? 'w-[22px] h-[30px]' : 'w-[28px] h-[40px]'}`}
      style={{
        background:
          'repeating-linear-gradient(45deg,#1b4068,#1b4068 3px,#16395C 3px,#16395C 6px)',
      }}
    />
  );
}
