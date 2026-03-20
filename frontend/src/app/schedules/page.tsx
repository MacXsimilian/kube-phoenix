'use client'

import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import AddIcon from '@mui/icons-material/Add'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import { getSchedules, reorderSchedules } from '@/lib/api'
import type { Schedule } from '@/lib/types'
import ScheduleCard from '@/components/schedules/ScheduleCard'
import ScheduleDialog from '@/components/schedules/ScheduleDialog'
import { useAuth } from '@/lib/auth'
import { canEditSchedules, canTriggerSchedules } from '@/lib/rbac'

// ── Sortable wrapper ────────────────────────────────────────────────────────
// Thin component that wires dnd-kit's useSortable into ScheduleCard without
// giving ScheduleCard any knowledge of the drag library.
function SortableScheduleCard(props: React.ComponentProps<typeof ScheduleCard>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.schedule.id })

  return (
    <Box
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 1 : 'auto',
      }}
    >
      <ScheduleCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </Box>
  )
}

function EmptySlot({ label }: { label: string }) {
  return (
    <Box
      sx={{
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 2,
        p: 3,
        textAlign: 'center',
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  )
}

export default function SchedulesPage() {
  const { user } = useAuth()
  const hasEdit = canEditSchedules(user?.permissions)
  const hasTrigger = canTriggerSchedules(user?.permissions)
  const qc = useQueryClient()
  const { data: schedules = [], isLoading, isError, error } = useQuery({
    queryKey: ['schedules'],
    queryFn: getSchedules,
  })

  const [dialog, setDialog] = useState<{
    open: boolean
    schedule?: Schedule
    defaultType?: 'scale_down' | 'scale_up'
  }>({ open: false })

  const [snack, setSnack] = useState<{
    open: boolean
    msg: string
    severity: 'success' | 'error'
  }>({ open: false, msg: '', severity: 'success' })

  function notify(msg: string, severity: 'success' | 'error') {
    setSnack({ open: true, msg, severity })
  }

  // Stable server-sorted slices
  const sleepSchedules = schedules.filter((s) => s.type === 'scale_down')
  const wakeSchedules  = schedules.filter((s) => s.type === 'scale_up')

  // Local optimistic ID order — synced from server on every fetch
  const [sleepIds, setSleepIds] = useState<number[]>([])
  const [wakeIds,  setWakeIds]  = useState<number[]>([])

  useEffect(() => { setSleepIds(sleepSchedules.map((s) => s.id)) }, [schedules])
  useEffect(() => { setWakeIds(wakeSchedules.map((s) => s.id))  }, [schedules])

  const reorderMutation = useMutation({
    mutationFn: (args: { type: 'scale_down' | 'scale_up'; ids: number[] }) =>
      reorderSchedules(args.type, args.ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] })
    },
    onError: (_, vars) => {
      // Revert optimistic update
      if (vars.type === 'scale_down') setSleepIds(sleepSchedules.map((s) => s.id))
      else                            setWakeIds(wakeSchedules.map((s) => s.id))
      notify('Failed to save order', 'error')
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragEnd(event: DragEndEvent, type: 'scale_down' | 'scale_up') {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids    = type === 'scale_down' ? sleepIds : wakeIds
    const setIds = type === 'scale_down' ? setSleepIds : setWakeIds
    const oldIndex = ids.indexOf(active.id as number)
    const newIndex = ids.indexOf(over.id as number)
    const newIds = arrayMove(ids, oldIndex, newIndex)
    setIds(newIds)
    reorderMutation.mutate({ type, ids: newIds })
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load schedules: {error instanceof Error ? error.message : 'Unknown error'}
      </Alert>
    )
  }

  return (
    <>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Schedules
      </Typography>

      {/* ── Sleep ─────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <BedtimeIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={700}>Sleep Schedules</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            Scale down workloads and drain nodes
          </Typography>
          {hasEdit && (
            <Button
              size="small"
              startIcon={<AddIcon fontSize="small" />}
              variant="outlined"
              sx={{ borderColor: 'divider' }}
              onClick={() => setDialog({ open: true, defaultType: 'scale_down' })}
            >
              Add
            </Button>
          )}
        </Box>

        {sleepSchedules.length === 0 ? (
          <EmptySlot label="No sleep schedules yet. Add one to start scaling down at night." />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={(e) => handleDragEnd(e, 'scale_down')}
          >
            <SortableContext items={sleepIds} strategy={verticalListSortingStrategy}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {sleepIds.map((id) => {
                  const sc = sleepSchedules.find((s) => s.id === id)
                  if (!sc) return null
                  return (
                    <SortableScheduleCard
                      key={sc.id}
                      schedule={sc}
                      onEdit={() => setDialog({ open: true, schedule: sc })}
                      onDelete={() => { qc.invalidateQueries({ queryKey: ['schedules'] }); qc.invalidateQueries({ queryKey: ['overview'] }) }}
                      onNotify={notify}
                      canEdit={hasEdit}
                      canTrigger={hasTrigger}
                    />
                  )
                })}
              </Box>
            </SortableContext>
          </DndContext>
        )}
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* ── Wake ──────────────────────────────────────────────────────── */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <WbSunnyIcon sx={{ color: 'warning.main', fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={700}>Wake Schedules</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            Restore workloads from saved replica counts
          </Typography>
          {hasEdit && (
            <Button
              size="small"
              startIcon={<AddIcon fontSize="small" />}
              variant="outlined"
              sx={{ borderColor: 'divider' }}
              onClick={() => setDialog({ open: true, defaultType: 'scale_up' })}
            >
              Add
            </Button>
          )}
        </Box>

        {wakeSchedules.length === 0 ? (
          <EmptySlot label="No wake schedules yet. Add one to restore workloads in the morning." />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={(e) => handleDragEnd(e, 'scale_up')}
          >
            <SortableContext items={wakeIds} strategy={verticalListSortingStrategy}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {wakeIds.map((id) => {
                  const sc = wakeSchedules.find((s) => s.id === id)
                  if (!sc) return null
                  return (
                    <SortableScheduleCard
                      key={sc.id}
                      schedule={sc}
                      onEdit={() => setDialog({ open: true, schedule: sc })}
                      onDelete={() => { qc.invalidateQueries({ queryKey: ['schedules'] }); qc.invalidateQueries({ queryKey: ['overview'] }) }}
                      onNotify={notify}
                      canEdit={hasEdit}
                      canTrigger={hasTrigger}
                    />
                  )
                })}
              </Box>
            </SortableContext>
          </DndContext>
        )}
      </Box>

      <ScheduleDialog
        open={dialog.open}
        schedule={dialog.schedule}
        defaultType={dialog.defaultType}
        onClose={() => setDialog({ open: false })}
        onSaved={() => notify('Schedule saved', 'success')}
      />

      {/* Single shared Snackbar for all schedule mutations */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  )
}
