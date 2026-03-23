'use client'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined'

type ThemeMode = 'light' | 'dark' | 'system'

export default function AppearanceSettings({
  mode,
  onModeChange,
}: {
  mode: ThemeMode
  onModeChange: (newMode: ThemeMode) => void
}) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Appearance
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2.5}>
          Choose how kube-phoenix looks. System follows your OS preference.
        </Typography>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, v) => v && onModeChange(v as ThemeMode)}
          aria-label="Theme mode"
          sx={{ alignSelf: 'center' }}
        >
          <ToggleButton value="light" aria-label="Light mode" sx={{ gap: 1, px: 2.5 }}>
            <LightModeOutlinedIcon fontSize="small" />
            Light
          </ToggleButton>
          <ToggleButton value="system" aria-label="System default" sx={{ gap: 1, px: 2.5 }}>
            <SettingsBrightnessOutlinedIcon fontSize="small" />
            System
          </ToggleButton>
          <ToggleButton value="dark" aria-label="Dark mode" sx={{ gap: 1, px: 2.5 }}>
            <DarkModeOutlinedIcon fontSize="small" />
            Dark
          </ToggleButton>
        </ToggleButtonGroup>
      </CardContent>
    </Card>
  )
}
