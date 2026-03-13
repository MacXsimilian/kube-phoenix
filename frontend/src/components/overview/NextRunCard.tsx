'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import ButtonBase from '@mui/material/ButtonBase'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { policiesApi } from '@/lib/api'
import type { SleepPolicy } from '@/lib/types'

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const m = Math.floor(diff / 60000)
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `in ${h}h ${rem}m` : `in ${h}h`
}

function PolicyRow({ policy }: { policy: SleepPolicy }) {
  const nextTime = policy.nextSleep ?? policy.nextWake
  const isSleep = !!policy.nextSleep && (!policy.nextWake || new Date(policy.nextSleep) <= new Date(policy.nextWake ?? '9999'))

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 2,
          bgcolor: isSleep ? 'rgba(124,58,237,0.15)' : 'rgba(245,158,11,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isSleep ? (
          <BedtimeIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        ) : (
          <WbSunnyIcon sx={{ fontSize: 18, color: 'warning.main' }} />
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="body2" fontWeight={600}>
            {policy.name}
          </Typography>
          {!policy.enabled ? (
            <Chip label="Disabled" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255,255,255,0.08)' }} />
          ) : policy.mode === 'apply' ? (
            <Chip label="APPLY" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(245,158,11,0.2)', color: 'warning.main' }} />
          ) : (
            <Chip label="PLAN" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(59,130,246,0.2)', color: 'info.main' }} />
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {policy.timezone}
        </Typography>
        {nextTime ? (
          <Typography
            variant="caption"
            fontWeight={600}
            sx={{ color: isSleep ? 'primary.light' : 'warning.light' }}
          >
            Next {isSleep ? 'sleep' : 'wake'} {timeUntil(nextTime)}
          </Typography>
        ) : (
          <Typography variant="caption" color="text.disabled">
            Not scheduled
          </Typography>
        )}
      </Box>
    </Box>
  )
}

export default function NextRunCard() {
  const router = useRouter()
  const { data } = useQuery({
    queryKey: ['policies'],
    queryFn: policiesApi.list,
    refetchInterval: 30_000,
  })

  const policies = data?.policies ?? []

  const sorted = [...policies].sort((a, b) => {
    const aNext = a.nextSleep ?? a.nextWake
    const bNext = b.nextSleep ?? b.nextWake
    if (!aNext && !bNext) return 0
    if (!aNext) return 1
    if (!bNext) return -1
    return new Date(aNext).getTime() - new Date(bNext).getTime()
  })

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            POLICIES
          </Typography>
          <ButtonBase
            onClick={() => router.push('/policies/')}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', borderRadius: 1, px: 0.5, '&:hover': { color: 'text.primary' } }}
          >
            <Typography variant="caption">View all</Typography>
            <ArrowForwardIcon sx={{ fontSize: 13 }} />
          </ButtonBase>
        </Box>

        {sorted.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No policies configured.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sorted.map((policy, i) => (
              <Box key={policy.id}>
                {i > 0 && <Divider sx={{ mb: 2 }} />}
                <PolicyRow policy={policy} />
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
