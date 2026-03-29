'use client'

import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActionArea from '@mui/material/CardActionArea'
import Grid from '@mui/material/Grid'
import Link from 'next/link'

const variants = [
  { id: 'a', title: 'Tabbed', desc: 'Horizontal tabs — one section visible at a time. Reduces clutter by hiding inactive sections.' },
  { id: 'b', title: 'Accordion', desc: 'Collapsible vertical sections with summary badges. Expand what you need, collapse the rest.' },
  { id: 'c', title: 'Sidebar Nav', desc: 'Left navigation rail with section links. Settings-app feel, good for many categories.' },
  { id: 'd', title: 'Category Cards', desc: 'Dashboard-style cards with stat pills. Click to expand inline. Scannable at a glance.' },
  { id: 'e', title: 'Hybrid B+D', desc: 'D-style card headers with icon boxes and stat pills, B-style accordion interiors with refined padding.' },
]

export default function GuardrailsRedesignIndex() {
  return (
    <>
      <Typography variant="h5" fontWeight={700} mb={1}>
        Guardrails Redesign Prototypes
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Four layout variants. All use the same data and API — pick the one that feels best.
      </Typography>

      <Grid container spacing={2}>
        {variants.map((v) => (
          <Grid key={v.id} size={{ xs: 12, sm: 6 }}>
            <Card variant="outlined">
              <CardActionArea component={Link} href={`/guardrails-redesign/${v.id}`}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                    <Typography variant="h6" fontWeight={700}>
                      Variant {v.id.toUpperCase()}
                    </Typography>
                    <Typography variant="body2" color="primary.main" fontWeight={600}>
                      {v.title}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {v.desc}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  )
}
