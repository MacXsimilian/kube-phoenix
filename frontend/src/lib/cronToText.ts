import cronstrue from 'cronstrue'

export function cronToText(expr: string): string {
  try {
    return cronstrue.toString(expr, { use24HourTimeFormat: true, verbose: false })
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[cronToText] Failed to parse expression:', expr, e)
    }
    return expr
  }
}
