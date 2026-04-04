'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { useObservabilityStream } from '@/lib/useObservabilityStream'
import MetricsDashboard from '@/components/observability/MetricsDashboard'
import ApiRivers from '@/components/observability/ApiRivers'
import type { TimeRange } from '@/lib/observability-types'

const TAB_NAMES = ['metrics', 'rivers'] as const
const TIME_RANGE_VALUES: TimeRange[] = ['1m', '5m', '15m', '1h', '6h', '1d', '3d']

function parseTabParam(param: string | null): number {
  if (param === 'rivers') return 1
  return 0
}

function parseRangeParam(param: string | null): TimeRange {
  if (param && TIME_RANGE_VALUES.includes(param as TimeRange)) return param as TimeRange
  return '1m'
}

export default function ObservabilityPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const stream = useObservabilityStream()

  const [activeTab, setActiveTab] = useState(() => parseTabParam(searchParams.get('tab')))
  const [timeRange, setTimeRange] = useState<TimeRange>(() => parseRangeParam(searchParams.get('range')))

  const updateUrl = useCallback((tab: number, range: TimeRange) => {
    const params = new URLSearchParams()
    params.set('tab', TAB_NAMES[tab])
    params.set('range', range)
    router.replace(`?${params.toString()}`)
  }, [router])

  const handleTabChange = useCallback((tab: number) => {
    setActiveTab(tab)
    updateUrl(tab, timeRange)
  }, [timeRange, updateUrl])

  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range)
    updateUrl(activeTab, range)
  }, [activeTab, updateUrl])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if (e.key === 't') {
        handleTabChange(activeTab === 0 ? 1 : 0)
        return
      }

      if (e.key === '/') {
        e.preventDefault()
        const container = document.getElementById('observability-root')
        const input = container?.querySelector<HTMLInputElement>('input[type="text"]')
        input?.focus()
        return
      }

      if (e.key === 'Escape') {
        document.querySelectorAll<HTMLElement>('[role="dialog"]').forEach((el) => {
          const closeBtn = el.querySelector<HTMLButtonElement>('button[aria-label="close"]') ?? el.querySelector<HTMLButtonElement>('button')
          closeBtn?.click()
        })
        return
      }

      const rangeIndex = parseInt(e.key, 10) - 1
      if (rangeIndex >= 0 && rangeIndex < TIME_RANGE_VALUES.length) {
        handleTimeRangeChange(TIME_RANGE_VALUES[rangeIndex])
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, handleTabChange, handleTimeRangeChange])

  return (
    <Box id="observability-root" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        value={activeTab}
        onChange={(_, v) => handleTabChange(v)}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          px: 2,
          minHeight: 44,
          '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 600 },
        }}
      >
        <Tab label="Metrics Dashboard" />
        <Tab label="API Rivers" />
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 0 && (
          <MetricsDashboard
            stream={stream}
            timeRange={timeRange}
            onTimeRangeChange={handleTimeRangeChange}
          />
        )}
        {activeTab === 1 && <ApiRivers stream={stream} />}
      </Box>
    </Box>
  )
}
