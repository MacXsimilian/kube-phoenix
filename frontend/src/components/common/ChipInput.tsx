'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'

export interface ChipInputProps {
  id: string
  label?: string
  hint?: string
  values: string[]
  onChange: (v: string[]) => void
  onDelete?: (v: string) => void
  readOnly?: boolean
  containerSx?: SxProps<Theme>
  chipSx?: SxProps<Theme>
}

export function ChipInput({
  id,
  label,
  hint,
  values,
  onChange,
  onDelete,
  readOnly = false,
  containerSx,
  chipSx,
}: ChipInputProps) {
  const [input, setInput] = useState('')

  const add = () => {
    const trimmed = input.trim()
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed])
    setInput('')
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); add() }
    if (e.key === 'Backspace' && input === '' && values.length > 0 && !onDelete) onChange(values.slice(0, -1))
  }

  const handleDelete = (v: string) => {
    if (onDelete) onDelete(v)
    else onChange(values.filter((x) => x !== v))
  }

  return (
    <Box>
      {label && (
        <Typography component="label" htmlFor={id} variant="body2" fontWeight={600} mb={1} display="block">
          {label}
        </Typography>
      )}
      {hint && (
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          {hint}
        </Typography>
      )}
      <Box
        sx={{
          display: 'flex', flexWrap: 'wrap', gap: 0.75,
          p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2,
          minHeight: 52, cursor: 'text',
          '&:focus-within': { borderColor: 'primary.main' },
          ...containerSx,
        }}
        onClick={() => document.getElementById(id)?.focus()}
      >
        {values.map((v) => (
          <Chip
            key={v}
            label={v}
            size="small"
            onDelete={readOnly ? undefined : () => handleDelete(v)}
            sx={{ fontFamily: 'monospace', fontSize: 12, ...chipSx }}
          />
        ))}
        {!readOnly && (
          <input
            id={id}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            onBlur={add}
            placeholder={values.length === 0 ? 'Type and press Enter...' : ''}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit', fontSize: 13, fontFamily: 'inherit', minWidth: 140, flex: 1 }}
          />
        )}
      </Box>
    </Box>
  )
}
