import { useEffect, useRef } from 'react'
import type { JSX } from 'react'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  rotation: number
  rotationSpeed: number
  width: number
  height: number
  opacity: number
}

const COLORS = ['#f4a024', '#3dbe8a', '#5da2e0', '#eaf1f8', '#f4a024', '#fde68a']

// Lightweight canvas confetti burst, no dependencies. Fires once on mount,
// runs for ~2.5 s, then stops. Uses requestAnimationFrame for smooth 60fps.
export function ConfettiCanvas(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    canvas.width = W
    canvas.height = H

    const particles: Particle[] = Array.from({ length: 80 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3,
      y: H * 0.35,
      vx: (Math.random() - 0.5) * 8,
      vy: -(Math.random() * 6 + 4),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      width: Math.random() * 8 + 4,
      height: Math.random() * 4 + 2,
      opacity: 1,
    }))

    let frame: number
    const startTime = performance.now()
    const DURATION = 2500

    function draw(now: number): void {
      const elapsed = now - startTime
      if (elapsed > DURATION) {
        ctx!.clearRect(0, 0, W, H)
        return
      }

      ctx!.clearRect(0, 0, W, H)

      for (const p of particles) {
        p.x += p.vx
        p.vy += 0.18
        p.y += p.vy
        p.rotation += p.rotationSpeed
        p.opacity = Math.max(0, 1 - elapsed / DURATION)

        ctx!.save()
        ctx!.globalAlpha = p.opacity
        ctx!.translate(p.x, p.y)
        ctx!.rotate(p.rotation)
        ctx!.fillStyle = p.color
        ctx!.fillRect(-p.width / 2, -p.height / 2, p.width, p.height)
        ctx!.restore()
      }

      frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  )
}
