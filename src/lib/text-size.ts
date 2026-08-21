const STORAGE_KEY = 'text-size'
type TextSize = 'default' | 'large' | 'xl'

export function getTextSize(): TextSize {
  return (localStorage.getItem(STORAGE_KEY) as TextSize | null) ?? 'default'
}

export function setTextSize(size: TextSize): void {
  localStorage.setItem(STORAGE_KEY, size)
  applyTextSize(size)
}

export function applyTextSize(size: TextSize): void {
  const html = document.documentElement
  html.classList.remove('text-size-large', 'text-size-xl')
  if (size === 'large') html.classList.add('text-size-large')
  else if (size === 'xl') html.classList.add('text-size-xl')
}

export const TEXT_SIZE_OPTIONS: { value: TextSize; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'large',   label: 'Large'   },
  { value: 'xl',      label: 'Extra Large' },
]
