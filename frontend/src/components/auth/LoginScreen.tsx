'use client'

import { useState, FormEvent } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import { useAuth } from '@/lib/auth'
import { formatError } from '@/lib/formatters'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export default function LoginScreen() {
  const { login, oidcEnabled } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
    } catch (err) {
      const msg = formatError(err)
      if (msg === 'Invalid credentials' || msg.includes('401')) {
        setError('Invalid credentials. Please try again.')
      } else if (msg === 'Too many attempts' || msg.includes('429')) {
        setError('Too many login attempts. Please wait a few minutes.')
      } else {
        setError('Could not reach the server. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSSO = () => {
    window.location.href = `${BASE}/api/auth/oidc/login`
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Paper
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 380,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 56, lineHeight: 1, userSelect: 'none' }}>🐦‍🔥</Typography>
          <Typography variant="h6" fontWeight={700} letterSpacing={-0.5}>
            kube-phoenix
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sign in to continue
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        )}

        {/* SSO Button — shown when OIDC is configured */}
        {oidcEnabled && (
          <>
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleSSO}
            >
              Login with SSO
            </Button>
            <Divider sx={{ width: '100%' }}>or sign in with credentials</Divider>
          </>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
            autoComplete="username"
            autoFocus={!oidcEnabled}
            disabled={loading}
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            autoComplete="current-password"
            disabled={loading}
          />
          <Button
            type="submit"
            variant={oidcEnabled ? 'outlined' : 'contained'}
            fullWidth
            size="large"
            disabled={loading || !username || !password}
            sx={{ mt: 1 }}
          >
            {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
