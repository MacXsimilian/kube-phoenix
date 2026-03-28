'use client'

import { useMutation } from '@tanstack/react-query'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import { updateUserSettings } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { TIMEZONES } from '@/lib/constants'
import { useSnackbar } from '@/lib/useSnackbar'
import type { User } from '@/lib/types'

const LABEL_SX = { textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 500 } as const

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={LABEL_SX}>
      {children}
    </Typography>
  )
}

export default function AccountSettings({ user }: { user: User }) {
  const { refreshUser } = useAuth()
  const { notify, SnackbarAlert } = useSnackbar()

  const mutation = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: () => {
      refreshUser()
      notify('Timezone updated', 'success')
    },
    onError: (err: Error) => {
      notify(err.message || 'Failed to update timezone', 'error')
    },
  })

  const handleTimezoneChange = (tz: string) => {
    mutation.mutate({ defaultTimezone: tz })
  }

  return (
    <>
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <PersonOutlineIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={700}>
              Profile &amp; Security
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" mb={2.5}>
            Your account information and credentials.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 140 }}>
                <FieldLabel>Username</FieldLabel>
                <Typography variant="body2" fontWeight={500}>
                  {user.username}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 140 }}>
                <FieldLabel>Role</FieldLabel>
                <Box sx={{ mt: 0.25 }}>
                  <Chip
                    label={user.role}
                    size="small"
                    color={user.role === 'admin' ? 'error' : user.role === 'operator' ? 'warning' : 'default'}
                    variant="outlined"
                  />
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 140 }}>
                <FieldLabel>Full Name</FieldLabel>
                <Typography variant="body2" fontWeight={500}>
                  {[user.givenName, user.familyName].filter(Boolean).join(' ') || '\u2014'}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 140 }}>
                <FieldLabel>Auth Source</FieldLabel>
                <Typography variant="body2" fontWeight={500}>
                  {user.source === 'oidc' ? 'SSO (OIDC)' : 'Local'}
                </Typography>
              </Box>
            </Box>

            <Divider />

            <Box>
              <FieldLabel>Default Timezone</FieldLabel>
              <FormControl fullWidth size="small" sx={{ mt: 0.5 }}>
                <Select
                  value={user.defaultTimezone ?? 'UTC'}
                  onChange={(e) => handleTimezoneChange(e.target.value)}
                  disabled={mutation.isPending}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
                >
                  {TIMEZONES.map((tz) => (
                    <MenuItem key={tz} value={tz}>
                      {tz}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Pre-fills the timezone when creating new policies.
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {SnackbarAlert}
    </>
  )
}
