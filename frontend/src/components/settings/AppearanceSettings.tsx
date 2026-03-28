'use client'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
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
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <LightModeOutlinedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={700}>
            Appearance
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" mb={2.5}>
          Choose how kube-phoenix looks. System follows your OS preference.
        </Typography>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, v) => v && onModeChange(v as ThemeMode)}
          aria-label="Theme mode"
          sx={{ display: 'flex' }}
        >
          <ToggleButton
            value="light"
            aria-label="Light mode"
            sx={{ flex: 1, gap: 1, px: 2, py: 1.5, flexDirection: 'column' }}
          >
            <LightModeOutlinedIcon />
            <Typography variant="caption" fontWeight={600}>Light</Typography>
          </ToggleButton>
          <ToggleButton
            value="system"
            aria-label="System default"
            sx={{ flex: 1, gap: 1, px: 2, py: 1.5, flexDirection: 'column' }}
          >
            <SettingsBrightnessOutlinedIcon />
            <Typography variant="caption" fontWeight={600}>System</Typography>
          </ToggleButton>
          <ToggleButton
            value="dark"
            aria-label="Dark mode"
            sx={{ flex: 1, gap: 1, px: 2, py: 1.5, flexDirection: 'column' }}
          >
            <DarkModeOutlinedIcon />
            <Typography variant="caption" fontWeight={600}>Dark</Typography>
          </ToggleButton>
        </ToggleButtonGroup>
      </CardContent>
    </Card>
  )
}
