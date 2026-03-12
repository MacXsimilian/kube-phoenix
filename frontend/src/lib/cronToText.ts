/**
 * Convert a 5-field cron expression to a human-readable string.
 * Handles the most common patterns used in kube-phoenix.
 */
export function cronToText(expr: string): string {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return expr

  const [min, hour, dom, , dow] = parts

  const pad = (n: string) => n.padStart(2, '0')

  const isEveryDay = dom === '*' && dow === '*'
  const isWeekdays = dow === '1-5' && dom === '*'
  const isWeekends = dow === '0,6' && dom === '*'
  const isSpecificTime = min !== '*' && hour !== '*'

  const timeStr = isSpecificTime ? `${pad(hour)}:${pad(min)}` : null

  if (isWeekdays && timeStr) return `Weekdays at ${timeStr}`
  if (isEveryDay && timeStr) return `Every day at ${timeStr}`
  if (isWeekends && timeStr) return `Weekends at ${timeStr}`

  // Interval pattern e.g. "5-55/20 19-23 * * *"
  if (min.includes('/') && hour.includes('-')) {
    const [range, step] = min.split('/')
    const [startH, endH] = hour.split('-')
    return `Every ${step}m from ${pad(startH)}:${range.split('-')[0] || '00'} to ${pad(endH)}:59`
  }

  return expr
}
