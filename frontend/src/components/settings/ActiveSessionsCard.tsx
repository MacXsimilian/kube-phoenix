'use client'

import { useQuery } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import MonitorIcon from '@mui/icons-material/Monitor'
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone'
import TabletIcon from '@mui/icons-material/Tablet'
import Alert from '@mui/material/Alert'
import { getSessions, type SessionInfo } from '@/lib/api'
import { podAge } from '@/lib/formatters'

function deviceIcon(type: 'mobile' | 'tablet' | 'desktop'): React.ReactNode {
  const sx = { fontSize: 16, color: 'primary.main' }
  if (type === 'mobile') return <PhoneIphoneIcon sx={sx} />
  if (type === 'tablet') return <TabletIcon sx={sx} />
  return <MonitorIcon sx={sx} />
}

function parseDevice(ua: string): { label: string; type: 'mobile' | 'tablet' | 'desktop' } {
  const lower = ua.toLowerCase()

  if (/mobile|android.*mobile|iphone/.test(lower)) {
    return { label: 'Mobile', type: 'mobile' }
  }
  if (/ipad|android(?!.*mobile)|tablet/.test(lower)) {
    return { label: 'Tablet', type: 'tablet' }
  }

  let browser = 'Browser'
  if (/edg\//i.test(ua)) browser = 'Edge'
  else if (/chrome/i.test(ua) && !/chromium/i.test(ua)) browser = 'Chrome'
  else if (/firefox/i.test(ua)) browser = 'Firefox'
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari'

  let os = ''
  if (/windows/i.test(ua)) os = 'Windows'
  else if (/macintosh|mac os/i.test(ua)) os = 'macOS'
  else if (/linux/i.test(ua)) os = 'Linux'

  return { label: os ? `${browser} on ${os}` : browser, type: 'desktop' }
}

function SessionRow({ session }: { session: SessionInfo }) {
  const { label, type } = parseDevice(session.userAgent)

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 1.5,
        borderRadius: 1,
        bgcolor: 'background.default',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            bgcolor: 'rgba(124,58,237,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {deviceIcon(type)}
        </Box>
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ fontSize: 13 }}>
            {label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {session.ipAddress} &middot; {podAge(session.createdAt)}
          </Typography>
        </Box>
      </Box>
      {session.isCurrent && (
        <Box
          sx={{
            fontSize: 10.5,
            fontWeight: 600,
            px: 1,
            py: 0.25,
            borderRadius: '10px',
            bgcolor: 'rgba(34,197,94,0.08)',
            color: 'success.main',
          }}
        >
          Current
        </Box>
      )}
    </Box>
  )
}

export default function ActiveSessionsCard() {
  const { data: sessions, isLoading, isError } = useQuery({
    queryKey: ['sessions'],
    queryFn: getSessions,
  })

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <MonitorIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={700}>
            Active Sessions
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Devices currently signed in to your account.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {isError ? (
            <Alert severity="error">Could not load sessions.</Alert>
          ) : isLoading ? (
            <>
              <Skeleton variant="rounded" height={56} />
              <Skeleton variant="rounded" height={56} />
            </>
          ) : sessions && sessions.length > 0 ? (
            sessions.map((s) => <SessionRow key={s.id} session={s} />)
          ) : (
            <Typography variant="body2" color="text.secondary">
              No active sessions found.
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  )
}
