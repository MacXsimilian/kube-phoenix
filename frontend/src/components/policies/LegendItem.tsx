import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export default function LegendItem({
  color,
  label,
  variant = 'box',
}: {
  color: string
  label: string
  /** 'box' = square swatch (WeeklyTimeline), 'led' = pill with glow (LedGlowTimeline) */
  variant?: 'box' | 'led'
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {variant === 'led' ? (
        <Box sx={{
          width: 12,
          height: 4,
          borderRadius: 2,
          bgcolor: color,
          boxShadow: `0 0 6px ${color}`,
        }} />
      ) : (
        <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color, opacity: 0.4 }} />
      )}
      <Typography
        variant="caption"
        sx={[{
          color: "text.disabled"
        }, variant === 'led' && { fontSize: 11 }]}>
        {label}
      </Typography>
    </Box>
  );
}
