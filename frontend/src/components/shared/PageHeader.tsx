'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import NextLink from 'next/link'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { Fragment, type ReactNode } from 'react'

export type Crumb = { label: string; href?: string }

export interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  breadcrumbs?: Crumb[]
  actions?: ReactNode
  meta?: ReactNode
  tabs?: ReactNode
}

export default function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  meta,
  tabs,
}: PageHeaderProps) {
  return (
    <Box sx={{ mb: 3 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          {breadcrumbs.map((crumb, i) => (
            <Fragment key={`${crumb.label}-${i}`}>
              {i > 0 && (
                <ChevronRightIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              )}
              {crumb.href ? (
                <Link
                  component={NextLink}
                  href={crumb.href}
                  underline="hover"
                  variant="caption"
                  color="text.secondary"
                >
                  {crumb.label}
                </Link>
              ) : (
                <Typography variant="caption" color="text.primary">
                  {crumb.label}
                </Typography>
              )}
            </Fragment>
          ))}
        </Box>
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: -0.3 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && (
          <Box sx={{ flexShrink: 0, display: 'flex', gap: 1 }}>{actions}</Box>
        )}
      </Box>

      {meta && <Box sx={{ mt: 1.5 }}>{meta}</Box>}

      {tabs && (
        <Box sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}>{tabs}</Box>
      )}
    </Box>
  )
}
