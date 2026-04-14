import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useIsDark } from '@/lib/useIsDark'
import { subtleBorder } from '@/lib/statusColors'
import type { Policy } from '@/lib/types'
import { BLEED_MARGIN_X, BLEED_PADDING_X } from '@/lib/layoutConstants'

export default function PolicyMetadataRow({ policy }: { policy: Policy }) {
  const isDark = useIsDark()
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
        <Typography variant="caption" sx={{
          color: "text.disabled"
        }}>Timezone</Typography>
        <Typography variant="body2">{policy.timezone || 'UTC'}</Typography>
      </Box>
      {policy.namespaceFilter && (
        <Box>
          <Typography variant="caption" sx={{
            color: "text.disabled"
          }}>Namespaces</Typography>
          <Typography variant="body2">{policy.namespaceFilter}</Typography>
        </Box>
      )}
      {policy.labelSelector && (
        <Box>
          <Typography variant="caption" sx={{
            color: "text.disabled"
          }}>Label Selector</Typography>
          <Typography variant="body2" sx={{
            fontFamily: "monospace"
          }}>{policy.labelSelector}</Typography>
        </Box>
      )}
    </Box>
  );
}
