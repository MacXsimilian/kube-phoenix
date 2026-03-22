'use client'

import { Component, ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[kp] Uncaught error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minHeight: '50vh', justifyContent: 'center' }}>
          <Typography variant="h6" color="error">Something went wrong</Typography>
          <Typography variant="body2" color="text.secondary">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Typography>
          <Button variant="outlined" onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </Button>
        </Box>
      )
    }
    return this.props.children
  }
}
