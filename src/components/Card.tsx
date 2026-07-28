import type { JSX } from 'react';

const SUITS: Record<string, { symbol: string; color: string }> = {
  h: { symbol: '♥', color: '#C0392B' },
  d: { symbol: '♦', color: '#C0392B' },
  s: { symbol: '♠', color: '#1A1A1A' },
  c: { symbol: '♣', color: '#2E7D46' },
};

interface CardProps {
  card: string;
  size?: 'sm' | 'md';
}

export function Card({ card, size = 'md' }: CardProps): JSX.Element {
  const rank = card.slice(0, -1).toUpperCase();
  const suitChar = card.slice(-1).toLowerCase();
  const suit = SUITS[suitChar] ?? { symbol: suitChar.toUpperCase(), color: '#1A1A1A' };
  const displayRank = rank === 'T' ? '10' : rank;
  const isSmall = size === 'sm';

  return (
    <div
      className={`flex flex-col items-center justify-between bg-[#F7F5EF] border border-[#c9d2dd] rounded select-none ${
        isSmall ? 'w-[22px] h-[30px] py-[2px]' : 'w-[30px] h-[42px] py-[3px]'
      }`}
      style={{ color: suit.color }}
    >
      <span className={`font-bold leading-none ${isSmall ? 'text-[10px]' : 'text-[14px]'}`}>
        {displayRank}
      </span>
      <span className={`leading-none ${isSmall ? 'text-[12px]' : 'text-[17px]'}`}>
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
