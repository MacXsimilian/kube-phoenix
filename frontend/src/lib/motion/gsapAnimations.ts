/**
 * Named GSAP animation functions for kube-phoenix.
 * Each function targets a DOM element and runs a self-contained animation.
 *
 * Usage:
 *   const el = useRef<HTMLDivElement>(null)
 *   useEffect(() => { if (el.current) animatePhoenixRise(el.current) }, [])
 */

import gsap from 'gsap'

// ── Node drain cell state machine ───────────────────────────────────────────

type DrainState = 'active' | 'cordoned' | 'draining' | 'deleted'

const DRAIN_COLORS: Record<DrainState, string> = {
  active: '#22C55E',
  cordoned: '#F59E0B',
  draining: '#EF4444',
  deleted: '#475569',
}

export function animateNodeDrain(el: HTMLElement, state: DrainState) {
  const color = DRAIN_COLORS[state]
  const tl = gsap.timeline()

  if (state === 'cordoned') {
    tl.to(el, { backgroundColor: color, duration: 0.3, ease: 'power2.out' })
      .to(el, { scale: 1.05, duration: 0.15, ease: 'power2.out' })
      .to(el, { scale: 1, duration: 0.15, ease: 'power2.inOut' })
  } else if (state === 'draining') {
    tl.to(el, { backgroundColor: color, duration: 0.2 })
      .to(el, { x: -3, duration: 0.05 })
      .to(el, { x: 3, duration: 0.05 })
      .to(el, { x: -2, duration: 0.05 })
      .to(el, { x: 0, duration: 0.05 })
  } else if (state === 'deleted') {
    tl.to(el, { backgroundColor: color, opacity: 0.4, duration: 0.5, ease: 'power2.inOut' })
  } else {
    tl.to(el, { backgroundColor: color, opacity: 1, scale: 1, duration: 0.3 })
  }

  return tl
}

// ── Replica bar scale animation ─────────────────────────────────────────────

export function animateReplicaBar(el: HTMLElement, fromCount: number, toCount: number) {
  const maxCount = Math.max(fromCount, toCount, 1)
  const fromPct = (fromCount / maxCount) * 100
  const toPct = (toCount / maxCount) * 100

  gsap.fromTo(
    el,
    { width: `${fromPct}%` },
    {
      width: `${toPct}%`,
      duration: 0.4,
      ease: 'power2.inOut',
      onUpdate() {
        const progress = gsap.getProperty(el, 'width') as string
        const pct = parseFloat(progress)
        if (pct < 30) el.style.backgroundColor = '#EF4444'
        else if (pct < 70) el.style.backgroundColor = '#F59E0B'
        else el.style.backgroundColor = '#22C55E'
      },
    },
  )
}

// ── Phoenix rise (sleep → wake celebration) ─────────────────────────────────

export function animatePhoenixRise(el: HTMLElement) {
  const tl = gsap.timeline()

  tl.fromTo(el, { opacity: 0.3, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' })
    .fromTo(
      el,
      { boxShadow: '0 0 0px rgba(245,158,11,0)' },
      { boxShadow: '0 0 40px rgba(245,158,11,0.4)', duration: 0.6, ease: 'power2.out' },
      '<',
    )
    .to(el, { boxShadow: '0 0 20px rgba(34,197,94,0.3)', duration: 0.8, ease: 'power2.inOut' })
    .to(el, { boxShadow: '0 0 0px rgba(34,197,94,0)', duration: 0.6, ease: 'power2.in' })

  return tl
}

// ── Phoenix sleep (wake → sleep dimming) ────────────────────────────────────

export function animatePhoenixSleep(el: HTMLElement) {
  const tl = gsap.timeline()

  tl.to(el, {
    boxShadow: '0 0 30px rgba(124,58,237,0.3)',
    duration: 0.5,
    ease: 'power2.out',
  })
    .to(el, { opacity: 0.7, duration: 0.6, ease: 'power2.inOut' })
    .to(el, { opacity: 1, boxShadow: '0 0 0px rgba(124,58,237,0)', duration: 0.4 })

  return tl
}

// ── Danger zone countdown ring ──────────────────────────────────────────────

export function animateDangerZone(el: SVGCircleElement, durationSec: number = 3) {
  const circumference = 2 * Math.PI * parseFloat(el.getAttribute('r') ?? '20')
  el.style.strokeDasharray = `${circumference}`
  el.style.strokeDashoffset = `${circumference}`

  return gsap.to(el, {
    strokeDashoffset: 0,
    duration: durationSec,
    ease: 'linear',
  })
}

// ── Number counter ──────────────────────────────────────────────────────────

export function animateCounter(
  el: HTMLElement,
  from: number,
  to: number,
  durationSec: number = 0.4,
) {
  const obj = { value: from }
  gsap.to(obj, {
    value: to,
    duration: durationSec,
    ease: 'power2.out',
    onUpdate() {
      el.textContent = String(Math.round(obj.value))
    },
  })
}
