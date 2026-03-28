import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

interface EmptyStateBoxProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyStateBox({ icon, title, description, action }: EmptyStateBoxProps) {
  return (
    <Box
      sx={{
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 2,
        p: 4,
        textAlign: 'center',
      }}
    >
      {icon && <Box sx={{ mb: 1 }}>{icon}</Box>}
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  )
}
