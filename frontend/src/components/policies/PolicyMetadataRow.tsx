import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { subtleBorder } from '@/lib/statusColors'
import type { Policy } from '@/lib/types'

const BLEED_MARGIN_X = { xs: -2, sm: -2.5, md: -3 }
const BLEED_PADDING_X = { xs: 2, sm: 2.5, md: 3 }

export default function PolicyMetadataRow({ policy }: { policy: Policy }) {
  const isDark = useTheme().palette.mode === 'dark'
  return (
    <Box
      sx={{
        mx: BLEED_MARGIN_X,
        px: BLEED_PADDING_X,
        py: 2,
        borderBottom: '1px solid',
        borderColor: subtleBorder(isDark),
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap',
      }}
    >
      <Box>
        <Typography variant="caption" color="text.disabled">Timezone</Typography>
        <Typography variant="body2">{policy.timezone || 'UTC'}</Typography>
      </Box>
      {policy.namespaceFilter && (
        <Box>
          <Typography variant="caption" color="text.disabled">Namespaces</Typography>
          <Typography variant="body2">{policy.namespaceFilter}</Typography>
        </Box>
      )}
      {policy.labelSelector && (
        <Box>
          <Typography variant="caption" color="text.disabled">Label Selector</Typography>
          <Typography variant="body2" fontFamily="monospace">{policy.labelSelector}</Typography>
        </Box>
      )}
    </Box>
  )
}
