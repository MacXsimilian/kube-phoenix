import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

interface LabeledSwitchProps {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}

export default function LabeledSwitch({ label, description, checked, disabled, onChange }: LabeledSwitchProps) {
  return (
    <FormControlLabel
      control={<Switch checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />}
      label={
        <Box>
          <Typography variant="body2" fontWeight={600}>{label}</Typography>
          <Typography variant="caption" color="text.secondary">{description}</Typography>
        </Box>
      }
    />
  )
}
