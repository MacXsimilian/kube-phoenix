'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DnsIcon from '@mui/icons-material/Dns'
import StorageIcon from '@mui/icons-material/Storage'
import { useTheme } from '@mui/material/styles'
import { semanticColors } from '@/lib/colors'
import { parseSummary, type WorkloadEntry, type NodeEntry } from './parseSummary'
import type { LogLine } from '@/lib/types'

function actionChip(isDark: boolean): Record<WorkloadEntry['action'], { label: string; color: string }> {
  const c = semanticColors(isDark)
  return {
    scaled:   { label: '→ 0',     color: c.purple },
    restored: { label: 'restored', color: c.success },
    plan:     { label: 'plan',     color: c.info },
  }
}

function nodeChip(isDark: boolean): Record<NodeEntry['action'], { label: string; color: string }> {
  const c = semanticColors(isDark)
  return {
    drained:   { label: 'drained',   color: c.warning },
    deleted:   { label: 'deleted',   color: c.error },
    plan:      { label: 'plan',      color: c.info },
    protected: { label: 'protected', color: '#6B7280' },
  }
}

export default function ExecutionSummary({ lines }: { lines: LogLine[] }) {
  const isDark = useTheme().palette.mode === 'dark'
  const { workloads, nodes, errors } = parseSummary(lines)

  if (workloads.length === 0 && nodes.length === 0 && errors.length === 0) return null

  // Group workloads by namespace
  const byNs = workloads.reduce<Record<string, WorkloadEntry[]>>((acc, w) => {
    ;(acc[w.ns] ??= []).push(w)
    return acc
  }, {})

  return (
    <Accordion
      defaultExpanded={false}
      disableGutters
      sx={{
        bgcolor: 'background.paper',
        '&:before': { display: 'none' },
        borderBottom: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
        sx={{ minHeight: 40, px: 2.5, py: 0, '& .MuiAccordionSummary-content': { my: 0, display: 'flex', alignItems: 'center', gap: 1 } }}
      >
        <Typography variant="caption" fontWeight={700} letterSpacing={0.8} sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
          Summary
        </Typography>
        {(workloads.length + nodes.length) > 0 && (
          <Chip
            label={workloads.length + nodes.length}
            size="small"
            sx={{ height: 16, fontSize: 10, bgcolor: 'rgba(124,58,237,0.2)', color: 'primary.main', '& .MuiChip-label': { px: 0.75 } }}
          />
        )}
        {errors.length > 0 && (
          <Chip
            label={`${errors.length} err`}
            size="small"
            sx={{ height: 16, fontSize: 10, bgcolor: isDark ? 'rgba(248,113,113,0.15)' : 'rgba(185,28,28,0.10)', color: isDark ? '#F87171' : '#B91C1C', '& .MuiChip-label': { px: 0.75 } }}
          />
        )}
      </AccordionSummary>

      <AccordionDetails sx={{ p: 0, pb: 1.5, maxHeight: 320, overflowY: 'auto' }}>
        {/* Workloads */}
        {workloads.length > 0 && (
          <Box sx={{ px: 2.5, pt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
              <DnsIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                WORKLOADS ({workloads.length})
              </Typography>
            </Box>
            {Object.entries(byNs).map(([ns, items]) => (
              <Box key={ns} sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', pl: 0.5, fontFamily: 'monospace', display: 'block', mb: 0.25 }}>
                  {ns}
                </Typography>
                <Table size="small" sx={{ '& td': { border: 0, py: 0.25, px: 0.5 } }}>
                  <TableBody>
                    {items.map((w) => {
                      const chip = actionChip(isDark)[w.action]
                      return (
                        <TableRow key={`${w.kind}/${w.name}/${w.action}`}>
                          <TableCell sx={{ width: 90, pr: 1 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 11 }}>
                              {w.kind}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ flex: 1 }}>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.primary' }}>
                              {w.name}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ width: 70, textAlign: 'right' }}>
                            <Chip
                              label={w.action === 'restored' ? `→ ${w.targetReplicas}` : chip.label}
                              size="small"
                              sx={{ height: 16, fontSize: 10, bgcolor: `${chip.color}22`, color: chip.color, '& .MuiChip-label': { px: 0.75 } }}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Box>
            ))}
          </Box>
        )}

        {/* Nodes */}
        {nodes.length > 0 && (
          <Box sx={{ px: 2.5, pt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
              <StorageIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                NODES ({nodes.length})
              </Typography>
            </Box>
            <Table size="small" sx={{ '& td': { border: 0, py: 0.25, px: 0.5 } }}>
              <TableBody>
                {nodes.map((n) => {
                  const chip = nodeChip(isDark)[n.action]
                  return (
                    <TableRow key={`${n.name}/${n.action}`}>
                      <TableCell sx={{ flex: 1 }}>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.primary' }}>
                          {n.name}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ width: 70, textAlign: 'right' }}>
                        <Chip
                          label={chip.label}
                          size="small"
                          sx={{ height: 16, fontSize: 10, bgcolor: `${chip.color}22`, color: chip.color, '& .MuiChip-label': { px: 0.75 } }}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <Box sx={{ px: 2, pt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {errors.map((e, idx) => (
              <Alert key={idx} severity="error" sx={{ py: 0, fontSize: 11 }}>
                {e}
              </Alert>
            ))}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  )
}
