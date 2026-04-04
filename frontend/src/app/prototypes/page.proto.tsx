'use client'

import { useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActionArea from '@mui/material/CardActionArea'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import { useRouter } from 'next/navigation'

interface Prototype {
  id: string
  code: string
  title: string
  category: string
  categoryColor: string
  description: string
  libraries: string[]
  implemented?: boolean
}

const PROTOTYPES: Prototype[] = [
  {
    id: 'flagship-topology',
    code: 'FL1',
    title: '3D Cluster Topology',
    category: 'Flagship',
    categoryColor: '#F97316',
    description: 'Interactive 3D WebGL cluster graph — orbit, zoom, drill into namespaces. Watch pods fade during sleep and ignite on wake.',
    libraries: ['Three.js', 'React Three Fiber', 'Drei'],
  },
  {
    id: 'flagship-theater',
    code: 'FL2',
    title: 'Execution Theater',
    category: 'Flagship',
    categoryColor: '#F97316',
    description: 'Mission-control execution viewer with 4 modes: Terminal, Panels, Cinematic, and Split View. Live log streaming simulation.',
    libraries: ['Framer Motion', 'GSAP', 'CSS'],
  },
  {
    id: 'flagship-heatmap',
    code: 'FL3',
    title: 'Node & Pod Health Heatmap',
    category: 'Flagship',
    categoryColor: '#F97316',
    description: 'Full-page heatmap dashboard — node grid colored by CPU, drill into pods, time scrubber, and sleep simulation.',
    libraries: ['Framer Motion', 'GSAP', 'MUI'],
  },
  {
    id: 'flagship-resource-flow',
    code: 'FL4',
    title: 'Resource Flow Sankey',
    category: 'Flagship',
    categoryColor: '#F97316',
    description: '4-level Sankey: Policies → Namespaces → Workloads → Nodes. Switch flow metric, simulate sleep, click for details.',
    libraries: ['eCharts', 'GSAP', 'Framer Motion'],
  },
  {
    id: 'flagship-constellation',
    code: 'FL5',
    title: 'Constellation Map',
    category: 'Flagship',
    categoryColor: '#F97316',
    description: 'Star-field topology — pods are twinkling stars, workloads are constellations, namespaces are nebulae. Sleep dims the sky.',
    libraries: ['Canvas 2D'],
  },
  {
    id: 'phoenix-rise',
    code: 'A1',
    title: 'Phoenix Rise',
    category: 'Onboarding',
    categoryColor: '#7C3AED',
    description: 'App Shell skeleton screen with shimmer effect and staggered content reveal on data load.',
    libraries: ['CSS Keyframes', 'Framer Motion'],
    implemented: false,
  },
  {
    id: 'staggered-reveal',
    code: 'A2',
    title: 'Staggered Reveal',
    category: 'Onboarding',
    categoryColor: '#7C3AED',
    description: 'Dashboard cards enter with a staggered fade-up pattern, creating a cascading reveal.',
    libraries: ['Framer Motion'],
    implemented: false,
  },
  {
    id: 'heartbeat-pulse',
    code: 'B1',
    title: 'Heartbeat Pulse',
    category: 'Real-Time',
    categoryColor: '#22C55E',
    description: 'Cluster status indicator with concentric ring pulses at varying cadences for health states.',
    libraries: ['CSS Keyframes'],
    implemented: false,
  },
  {
    id: 'stream-glow',
    code: 'B2',
    title: 'Stream Glow',
    category: 'Real-Time',
    categoryColor: '#22C55E',
    description: 'Real-time metric updates with glowing change highlights and animated number counting.',
    libraries: ['CSS Transitions'],
    implemented: false,
  },
  {
    id: 'log-waterfall',
    code: 'B3',
    title: 'Log Waterfall',
    category: 'Real-Time',
    categoryColor: '#22C55E',
    description: 'Rolling log stream with slide-in entries, error line highlighting, and auto-scroll.',
    libraries: ['CSS Transitions'],
    implemented: false,
  },
  {
    id: 'phoenix-lifecycle',
    code: 'C1',
    title: 'Phoenix Lifecycle',
    category: 'State Transitions',
    categoryColor: '#F59E0B',
    description: 'Pod state machine animation — Pending, Running, Succeeded, Failed, CrashLoopBackOff.',
    libraries: ['Framer Motion', 'CSS Keyframes'],
    implemented: false,
  },
  {
    id: 'rollout-wave',
    code: 'C2',
    title: 'Rollout Wave',
    category: 'State Transitions',
    categoryColor: '#F59E0B',
    description: 'Execution progress bar with wave fill, glowing leading edge, and barberpole pattern.',
    libraries: ['CSS Keyframes'],
    implemented: false,
  },
  {
    id: 'sleep-wake-morph',
    code: 'C3',
    title: 'Sleep / Wake Morph',
    category: 'State Transitions',
    categoryColor: '#F59E0B',
    description: 'Policy state chip morphing between sleep and awake with icon and color transitions.',
    libraries: ['Framer Motion'],
    implemented: false,
  },
  {
    id: 'drawer-slide',
    code: 'D1',
    title: 'Drawer Slide',
    category: 'Micro-Interactions',
    categoryColor: '#3B82F6',
    description: 'Detail drawer with spring physics, staggered content reveal, and fast close.',
    libraries: ['Framer Motion'],
    implemented: false,
  },
  {
    id: 'sidebar-morph',
    code: 'D2',
    title: 'Sidebar Morph',
    category: 'Micro-Interactions',
    categoryColor: '#3B82F6',
    description: 'Collapsible sidebar animation — labels fade, icons scale, content reflows smoothly.',
    libraries: ['Framer Motion'],
    implemented: false,
  },
  {
    id: 'replica-sparkline',
    code: 'F1',
    title: 'Replica Sparkline',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'eCharts step-line chart showing 24h sleep/wake replica pattern per policy card.',
    libraries: ['eCharts'],
  },
  {
    id: 'counter-animate',
    code: 'F2',
    title: 'Counter Animate',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Dashboard stat counters with Framer Motion number interpolation and SSE flash highlights.',
    libraries: ['Framer Motion'],
  },
  {
    id: 'cost-savings',
    code: 'F3',
    title: 'Cost Savings',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Weekly savings bar chart with staggered bar entrance + radial gauge with elastic needle.',
    libraries: ['eCharts'],
  },
  {
    id: 'node-drain-grid',
    code: 'F4',
    title: 'Node Drain Grid',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Real-time node state grid — cells transition green→amber→red→grey with GSAP as drain events arrive.',
    libraries: ['GSAP'],
  },
  {
    id: 'pod-metrics-chart',
    code: 'F5',
    title: 'Pod Metrics Chart',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Dual-axis streaming CPU/Memory line chart with eCharts real-time dataset shift animation.',
    libraries: ['eCharts'],
  },
  {
    id: 'sleep-window-pulse',
    code: 'F6',
    title: 'Sleep Window Pulse',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Weekly timeline where the active sleep segment pulses and approaching transitions glow brighter.',
    libraries: ['CSS Keyframes'],
  },
  {
    id: 'phoenix-moment',
    code: 'F7',
    title: 'Phoenix Moment',
    category: 'Delight',
    categoryColor: '#F97316',
    description: 'Cinematic sleep/wake transition — ember particles, icon morphing, GSAP timeline orchestration.',
    libraries: ['GSAP'],
  },
  {
    id: 'workload-waterfall',
    code: 'F8',
    title: 'Workload Waterfall',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Live replica bars shrink to 0 as WebSocket log lines arrive — split view with log feed.',
    libraries: ['GSAP'],
  },
  {
    id: 'exception-entrance',
    code: 'F9',
    title: 'Exception Entrance',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Exception blocks slide in with stagger, active exceptions pulse, layout animates on add/remove.',
    libraries: ['Framer Motion'],
  },
  {
    id: 'audit-diff',
    code: 'F10',
    title: 'Audit Diff',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Field-level before/after diff — old values strike-through and slide out, new values slide in.',
    libraries: ['Framer Motion'],
  },
  {
    id: 'danger-zone',
    code: 'F11',
    title: 'Danger Zone',
    category: 'Delight',
    categoryColor: '#F97316',
    description: 'Emergency scale countdown ring with GSAP arc draw, red pulse dialog, and visceral confirmation.',
    libraries: ['GSAP', 'Framer Motion'],
  },
  {
    id: 'skeleton-loading',
    code: 'F12',
    title: 'Skeleton Loading',
    category: 'Onboarding',
    categoryColor: '#7C3AED',
    description: 'Content-shaped MUI Skeletons → crossfade to real data with staggered row entrance.',
    libraries: ['MUI Skeleton', 'Framer Motion'],
  },
  {
    id: 'empty-state-egg',
    code: 'F13',
    title: 'Empty State Egg',
    category: 'Delight',
    categoryColor: '#F97316',
    description: 'SVG phoenix egg draws itself stroke-by-stroke, inner glow pulses, sparkle particles, CTA pulse.',
    libraries: ['SVG', 'CSS Keyframes'],
  },
  {
    id: 'prometheus-dashboard',
    code: 'G1',
    title: 'Prometheus Dashboard',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: '4-panel streaming metric dashboard — policy executions, K8s API calls, WebSocket connections, HTTP latency.',
    libraries: ['eCharts'],
  },
  {
    id: 'workload-heatmap',
    code: 'G2',
    title: 'Workload Heatmap',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Namespace x Hour heatmap of active replica counts — dark cells = sleeping, bright = active.',
    libraries: ['eCharts'],
  },
  {
    id: 'cluster-topology',
    code: 'G3',
    title: 'Cluster Topology',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Force-directed graph of cluster → nodes → pods with drag, zoom, and adjacency focus on click.',
    libraries: ['eCharts'],
  },
  {
    id: 'execution-log-summary',
    code: 'G4',
    title: 'Execution Log Summary',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Split-view: workload/node summary builds in real-time as log lines stream in during execution.',
    libraries: ['Framer Motion'],
  },
  {
    id: 'next-run-countdown',
    code: 'G5',
    title: 'Next Run Countdown',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'SVG ring countdown timers for next scheduled policy transitions — acceleratable, urgency pulse at <5min.',
    libraries: ['SVG', 'CSS Keyframes'],
  },
  {
    id: 'activity-timeline',
    code: 'G6',
    title: 'Activity Timeline',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Vertical timeline with animated entry cards — running dot pulses, failed entries have red borders.',
    libraries: ['Framer Motion'],
  },
  {
    id: 'guardrails-shield',
    code: 'G7',
    title: 'Guardrails Shield',
    category: 'Delight',
    categoryColor: '#F97316',
    description: 'Animated shield icon reacts to guardrail checks — shakes on block, pulses on allow, with evaluation log.',
    libraries: ['GSAP'],
  },
  {
    id: 'plan-apply-toggle',
    code: 'G8',
    title: 'Plan / Apply Toggle',
    category: 'Micro-Interactions',
    categoryColor: '#3B82F6',
    description: 'Weighted mode switch — plan→apply requires confirmation with spring dialog and GSAP glow. Apply→plan is instant.',
    libraries: ['GSAP', 'Framer Motion'],
  },
  {
    id: 'topology-live',
    code: 'G9',
    title: 'Live Topology',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Interactive cluster graph with live pod state simulation, namespace sleep/wake buttons, CPU-sized pod dots.',
    libraries: ['eCharts'],
  },
  {
    id: 'topology-treemap',
    code: 'G10',
    title: 'Topology Treemap',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Hierarchical treemap: namespace → workload. Size = replica count, color = status. Click to drill down, breadcrumb to zoom out.',
    libraries: ['eCharts'],
  },
  {
    id: 'topology-radial',
    code: 'G11',
    title: 'Radial Topology',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Concentric ring layout — cluster at center, nodes/namespaces/workloads/pods radiating outward. Click to expand, sleep to dim.',
    libraries: ['eCharts'],
  },
  {
    id: 'topology-circuit',
    code: 'G12',
    title: 'Circuit Board',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'PCB-aesthetic topology — nodes as IC chips, pods as LEDs, Manhattan-routed traces with animated current flow.',
    libraries: ['SVG', 'GSAP'],
  },
  {
    id: 'savings-ticker',
    code: 'H1',
    title: 'Savings Ticker',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Real-time cost savings counter that ticks up while workloads sleep — flip-digit animation, per-policy breakdown.',
    libraries: ['CSS Keyframes'],
  },
  {
    id: 'namespace-sankey',
    code: 'H2',
    title: 'Namespace Sankey',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Sankey flow diagram: Policies → Namespaces → Workloads. Width = replica count. Hover highlights flow path.',
    libraries: ['eCharts'],
  },
  {
    id: 'sleep-wake-calendar',
    code: 'H3',
    title: 'Sleep/Wake Calendar',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'GitHub-style calendar heatmap — daily sleep hours over a month. Darker = more sleep = more savings.',
    libraries: ['eCharts'],
  },
  {
    id: 'resource-sunburst',
    code: 'H4',
    title: 'Resource Sunburst',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Sunburst chart: Node → Namespace → Workload. Arc size = CPU millicores. Click to zoom into a ring. Faded = sleeping.',
    libraries: ['eCharts'],
  },
  {
    id: 'execution-flame',
    code: 'H5',
    title: 'Execution Flame',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Flame graph of a sleep execution — nested spans for validate, scale, drain, verify with timing and warn/error bars.',
    libraries: ['Framer Motion'],
  },
  {
    id: 'cluster-health-ring',
    code: 'H6',
    title: 'Cluster Health Ring',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Concentric gauge rings — CPU, Memory, Pod Health, Policy Coverage. Live updating with color-coded thresholds.',
    libraries: ['eCharts'],
  },
  {
    id: 'live-log-heatmap',
    code: 'H7',
    title: 'Live Log Heatmap',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Scrolling grid: workloads x time. Each cell = log level (green/amber/red). Errors glow. Streams in real-time.',
    libraries: ['CSS'],
  },
  {
    id: 'policy-compare-diff',
    code: 'H8',
    title: 'Policy Compare',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Side-by-side before/after policy diff — staggered row entrance, changed/added/removed highlighting, summary counts.',
    libraries: ['Framer Motion'],
  },
  {
    id: 'replica-odometer',
    code: 'I1',
    title: 'Replica Odometer',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Per-workload replica counters that roll down to 0 on sleep and back up on wake — staggered per workload with flash.',
    libraries: ['CSS Keyframes'],
  },
  {
    id: 'node-capacity-bar',
    code: 'I2',
    title: 'Node Capacity Bars',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Per-node CPU/Memory/Pod capacity bars with glow tip, threshold pulse at >85%, and live streaming simulation.',
    libraries: ['CSS Transitions'],
  },
  {
    id: 'cost-forecast-area',
    code: 'I3',
    title: 'Cost Forecast',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Cumulative cost area chart — actual (green) vs forecast (purple dashed) vs without kube-phoenix (red dashed). 7/30/90d toggle.',
    libraries: ['eCharts'],
  },
  {
    id: 'wake-ripple',
    code: 'I4',
    title: 'Wake Ripple',
    category: 'Delight',
    categoryColor: '#F97316',
    description: 'Workloads wake in a radial ripple from top-left — each cell lights up amber→green as the wave passes. GSAP per-cell.',
    libraries: ['GSAP'],
  },
  {
    id: 'scaling-matrix',
    code: 'I5',
    title: 'Scaling Matrix',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Dot matrix: each dot = one pod replica. Watch dots turn off one-by-one during sleep — grouped by namespace/workload.',
    libraries: ['CSS Transitions'],
  },
  // ── New Flagships ───────────────────────────────────────────────────────
  {
    id: 'multi-region-globe',
    code: 'FL6',
    title: 'Multi-Region Globe',
    category: 'Flagship',
    categoryColor: '#F97316',
    description: '3D Earth globe showing cloud regions with sleep/wake state — animated arcs, region zoom, procedural shaders.',
    libraries: ['Three.js', 'React Three Fiber', 'Drei', 'GSAP'],
    implemented: true,
  },
  {
    id: 'nervous-system',
    code: 'FL7',
    title: 'Cluster Nervous System',
    category: 'Flagship',
    categoryColor: '#F97316',
    description: 'Biological nervous system — neurons pulse, synaptic particles flow, anesthesia sleep wave, resuscitation wake burst.',
    libraries: ['Three.js', 'React Three Fiber', 'Drei', 'GSAP'],
    implemented: true,
  },
  {
    id: 'incident-cinema',
    code: 'FL8',
    title: 'Incident Cinema',
    category: 'Flagship',
    categoryColor: '#F97316',
    description: 'Cinematic replay of failed executions — 5 scene cuts with CSS 3D camera, red alert mode, scanlines, ember titles.',
    libraries: ['Framer Motion', 'GSAP', 'CSS 3D'],
    implemented: true,
  },
  // ── New Data Viz ────────────────────────────────────────────────────────
  {
    id: 'sigma-mega-cluster',
    code: 'J1',
    title: 'Sigma Mega Cluster',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: '850+ node WebGL-accelerated 2D graph with Barnes-Hut force layout, search, sleep wave, color modes.',
    libraries: ['Canvas 2D', 'GSAP'],
    implemented: true,
  },
  {
    id: 'observable-stream',
    code: 'J2',
    title: 'Observable Stream',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: '6 small-multiple streaming metric charts — Catmull-Rom curves, sleep bands, threshold glow, synchronized axes.',
    libraries: ['SVG', 'Framer Motion'],
    implemented: true,
  },
  {
    id: 'visx-calendar',
    code: 'J3',
    title: 'Execution Heatmap Calendar',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'GitHub-style 52-week heatmap of daily sleep hours — click to expand day detail, GSAP stagger wave entrance.',
    libraries: ['SVG', 'Framer Motion', 'GSAP'],
    implemented: true,
  },
  {
    id: 'nivo-chord',
    code: 'J4',
    title: 'Chord Dependency Map',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Namespace traffic chord diagram — sleeping arcs retract chords, hover highlights, bump chart ranking below.',
    libraries: ['SVG', 'Framer Motion', 'GSAP'],
    implemented: true,
  },
  {
    id: 'voronoi-namespaces',
    code: 'J5',
    title: 'Voronoi Namespace Map',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Namespace territory cells — area encodes pods, color encodes CPU%, sleeping cells shrink and neighbors expand.',
    libraries: ['SVG', 'Framer Motion', 'GSAP'],
    implemented: true,
  },
  {
    id: 'recharts-sparkboard',
    code: 'J6',
    title: 'Savings Sparkboard',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: '3×3 namespace cards with micro sparkline, CPU trend, and cost bar charts. Moon overlay on sleeping cards.',
    libraries: ['SVG', 'Framer Motion'],
    implemented: true,
  },
  {
    id: 'roughjs-plan-mode',
    code: 'J7',
    title: 'Plan Mode Preview',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Sketchy hand-drawn draft mode vs crisp apply mode — Canvas 2D noise, hatching, crossfade transition.',
    libraries: ['Canvas 2D', 'Framer Motion', 'GSAP'],
    implemented: true,
  },
  {
    id: 'polar-timeline',
    code: 'J8',
    title: 'Polar Timeline',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: '24-hour policy schedule as a polar clock — concentric rings, sweep hand, exception arcs, live countdown.',
    libraries: ['eCharts', 'Framer Motion'],
    implemented: true,
  },
  {
    id: 'deckgl-regions',
    code: 'J9',
    title: 'Multi-Region Map',
    category: 'Data Viz',
    categoryColor: '#22D3EE',
    description: 'Canvas 2D world map with region markers, animated traffic arcs, replica bars, sleep state transitions.',
    libraries: ['Canvas 2D', 'GSAP', 'Framer Motion'],
    implemented: true,
  },
  // ── New Micro-Interactions ──────────────────────────────────────────────
  {
    id: 'magnetic-nav',
    code: 'K1',
    title: 'Magnetic Nav Icons',
    category: 'Micro-Interactions',
    categoryColor: '#3B82F6',
    description: 'Sidebar nav icons with magnetic cursor attraction — spring physics pull, elastic click bounce, active glow.',
    libraries: ['Framer Motion', 'GSAP'],
    implemented: true,
  },
  {
    id: 'liquid-toggle',
    code: 'K2',
    title: 'Liquid Policy Toggle',
    category: 'Micro-Interactions',
    categoryColor: '#3B82F6',
    description: 'Plan/Apply toggle as a liquid morphing SVG blob — shape morphs, color shifts, liquid fill animation.',
    libraries: ['SVG', 'GSAP', 'Framer Motion'],
    implemented: true,
  },
  {
    id: 'particle-search',
    code: 'K3',
    title: 'Particle Search',
    category: 'Micro-Interactions',
    categoryColor: '#3B82F6',
    description: 'Search input with Canvas 2D particle burst on focus, staggered results, implosion on no match.',
    libraries: ['Canvas 2D', 'Framer Motion', 'GSAP'],
    implemented: true,
  },
  {
    id: 'replica-slots',
    code: 'K4',
    title: 'Replica Slot Machine',
    category: 'Micro-Interactions',
    categoryColor: '#3B82F6',
    description: 'Casino slot machine reels for replica counters — CSS 3D cylinder, elastic stop, directional spin.',
    libraries: ['CSS 3D', 'GSAP', 'Framer Motion'],
    implemented: true,
  },
  {
    id: 'glitch-error',
    code: 'K5',
    title: 'Glitch Error State',
    category: 'Micro-Interactions',
    categoryColor: '#3B82F6',
    description: 'CSS glitch effect on error — channel separation, scanline tearing, text scramble, elastic error badge.',
    libraries: ['CSS', 'GSAP', 'Framer Motion'],
    implemented: true,
  },
  {
    id: 'status-morph',
    code: 'K6',
    title: 'Morphing Status Badge',
    category: 'Micro-Interactions',
    categoryColor: '#3B82F6',
    description: 'Status chip morphs between awake/transitioning/sleeping — icon, color, shape, and width all animate.',
    libraries: ['Framer Motion'],
    implemented: true,
  },
  {
    id: 'metric-bubbles',
    code: 'K7',
    title: 'Floating Metric Bubbles',
    category: 'Micro-Interactions',
    categoryColor: '#3B82F6',
    description: 'Dashboard stats as floating physics bubbles — drift, collide, pop on click, inflate/deflate on update.',
    libraries: ['Canvas 2D', 'Framer Motion'],
    implemented: true,
  },
  {
    id: 'timeline-scrub',
    code: 'K8',
    title: 'Timeline Scrub Preview',
    category: 'Micro-Interactions',
    categoryColor: '#3B82F6',
    description: 'Video-player scrubber for execution history — hover thumbnail previews, chapter markers, smooth playhead.',
    libraries: ['SVG', 'Framer Motion', 'GSAP'],
    implemented: true,
  },
  {
    id: 'breathing-health',
    code: 'K9',
    title: 'Breathing Cluster Health',
    category: 'Micro-Interactions',
    categoryColor: '#3B82F6',
    description: 'Health indicator as a breathing organism — cycle speed and glow encode state, satellite namespace circles.',
    libraries: ['SVG', 'GSAP', 'Framer Motion'],
    implemented: true,
  },
  {
    id: 'confetti-success',
    code: 'K10',
    title: 'Confetti Policy Success',
    category: 'Micro-Interactions',
    categoryColor: '#3B82F6',
    description: 'Canvas 2D confetti burst on wake success — phoenix palette, elastic badge, GSAP count-up stats.',
    libraries: ['Canvas 2D', 'GSAP', 'Framer Motion'],
    implemented: true,
  },
  {
    id: 'neon-pulse',
    code: 'K11',
    title: 'Neon Border Pulse',
    category: 'Micro-Interactions',
    categoryColor: '#3B82F6',
    description: 'Policy cards with animated neon box-shadow borders — speed and color encode state, irregular error flicker.',
    libraries: ['CSS', 'GSAP', 'Framer Motion'],
    implemented: true,
  },
  {
    id: 'haptic-buttons',
    code: 'K12',
    title: 'Haptic Button Feedback',
    category: 'Micro-Interactions',
    categoryColor: '#3B82F6',
    description: 'Critical buttons with haptic visual feedback — compress, expand, shake, 3-second hold with progress ring.',
    libraries: ['GSAP', 'Framer Motion'],
    implemented: true,
  },
]

const CATEGORIES = [...new Set(PROTOTYPES.map((p) => p.category))]

export default function PrototypesIndex() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim()
    return PROTOTYPES.filter((p) => {
      if (activeCategory && p.category !== activeCategory) return false
      if (!query) return true
      return (
        p.title.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.libraries.some((lib) => lib.toLowerCase().includes(query))
      )
    })
  }, [search, activeCategory])

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ mb: 5 }}>
        <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
          Animation Prototypes
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600 }}>
          Interactive demos for the KubeFenix animation system. Each prototype is self-contained
          with controls to trigger, replay, and adjust the animation.
        </Typography>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          placeholder="Search prototypes..."
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ maxWidth: 400 }}
        />
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label="All"
            size="small"
            onClick={() => setActiveCategory(null)}
            sx={{
              fontWeight: 600,
              bgcolor: !activeCategory ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
              color: !activeCategory ? 'text.primary' : 'text.secondary',
            }}
          />
          {CATEGORIES.map((cat) => {
            const color = PROTOTYPES.find((p) => p.category === cat)!.categoryColor
            const isActive = activeCategory === cat
            return (
              <Chip
                key={cat}
                label={cat}
                size="small"
                onClick={() => setActiveCategory(isActive ? null : cat)}
                sx={{
                  fontWeight: 600,
                  bgcolor: isActive ? `${color}25` : 'rgba(255,255,255,0.04)',
                  color: isActive ? color : 'text.secondary',
                  border: isActive ? `1px solid ${color}40` : '1px solid transparent',
                }}
              />
            )
          })}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {filtered.length} of {PROTOTYPES.length} prototypes
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
          gap: 2.5,
        }}
      >
        {filtered.map((p) => (
          <Card
            key={p.id}
            sx={{
              bgcolor: 'background.paper',
              transition: 'border-color 200ms ease, box-shadow 200ms ease',
              '&:hover': {
                borderColor: p.categoryColor,
                boxShadow: `0 0 0 1px ${p.categoryColor}40`,
              },
            }}
          >
            <CardActionArea
              onClick={() => router.push(`/prototypes/${p.id}/`)}
              sx={{ height: '100%' }}
            >
              <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={p.code}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: 11,
                      fontWeight: 700,
                      bgcolor: `${p.categoryColor}20`,
                      color: p.categoryColor,
                    }}
                  />
                  <Chip
                    label={p.category}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: 11,
                      bgcolor: 'rgba(255,255,255,0.06)',
                      color: 'text.secondary',
                    }}
                  />
                  {p.implemented && (
                    <Chip
                      label="Implemented"
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: 11,
                        fontWeight: 600,
                        bgcolor: 'rgba(34,197,94,0.15)',
                        color: '#22C55E',
                        ml: 'auto',
                      }}
                    />
                  )}
                </Box>

                <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                  {p.title}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  {p.description}
                </Typography>

                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 'auto' }}>
                  {p.libraries.map((lib) => (
                    <Chip
                      key={lib}
                      label={lib}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: 10,
                        bgcolor: 'rgba(255,255,255,0.04)',
                        color: 'text.secondary',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    />
                  ))}
                </Box>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  )
}
