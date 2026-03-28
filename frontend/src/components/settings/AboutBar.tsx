'use client'

import { useQuery } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import GitHubIcon from '@mui/icons-material/GitHub'
import { getVersionInfo } from '@/lib/api'

export default function AboutBar() {
  const { data } = useQuery({
    queryKey: ['version'],
    queryFn: getVersionInfo,
    staleTime: 5 * 60 * 1000, // version/uptime changes slowly
  })

  return (
    <Card>
      <CardContent
        sx={{
          py: 2,
          px: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          '&:last-child': { pb: 2 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton
            component="a"
            href="https://github.com/MacXsimilian/kube-phoenix"
            target="_blank"
            rel="noopener"
            size="small"
            sx={{ color: 'text.disabled', '&:hover': { color: 'primary.light' } }}
          >
            <GitHubIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              kube-phoenix
            </Typography>
            {data ? (
              <Typography variant="body2" color="text.secondary">
                {data.version}
              </Typography>
            ) : (
              <Skeleton width={40} height={16} />
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 3 }}>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 11 }}>
              Go
            </Typography>
            {data ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 12.5 }}>
                {data.goVersion}
              </Typography>
            ) : (
              <Skeleton width={50} height={16} />
            )}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 11 }}>
              Uptime
            </Typography>
            {data ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
                {data.uptime}
              </Typography>
            ) : (
              <Skeleton width={70} height={16} />
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
