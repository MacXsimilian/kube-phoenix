/**
 * Custom eCharts themes for kube-phoenix dark and light modes.
 * Register once at app init: echarts.registerTheme('kube-phoenix-dark', darkTheme)
 */

const FONT = '"Inter", "Roboto", "Helvetica", "Arial", sans-serif'

export const darkTheme = {
  color: [
    '#7C3AED', '#22C55E', '#3B82F6', '#F59E0B', '#EF4444',
    '#22D3EE', '#F97316', '#6366F1', '#14B8A6', '#EC4899',
  ],
  backgroundColor: 'transparent',
  textStyle: { fontFamily: FONT, color: '#94A3B8' },
  title: {
    textStyle: { fontFamily: FONT, color: '#E2E8F0', fontWeight: 600 },
    subtextStyle: { fontFamily: FONT, color: '#64748B' },
  },
  line: {
    itemStyle: { borderWidth: 2 },
    lineStyle: { width: 2 },
    symbolSize: 0,
    symbol: 'circle',
    smooth: false,
  },
  bar: {
    itemStyle: { barBorderWidth: 0, barBorderRadius: [4, 4, 0, 0] },
  },
  gauge: {
    itemStyle: { borderWidth: 0 },
  },
  categoryAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#64748B', fontSize: 11, fontFamily: FONT },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#64748B', fontSize: 11, fontFamily: FONT },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)', type: 'dashed' } },
  },
  timeAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#64748B', fontSize: 11, fontFamily: FONT },
    splitLine: { show: false },
  },
  tooltip: {
    backgroundColor: '#1A1A24',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    textStyle: { color: '#E2E8F0', fontSize: 12, fontFamily: FONT },
    extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.4); border-radius: 8px;',
  },
  legend: {
    textStyle: { color: '#94A3B8', fontFamily: FONT, fontSize: 12 },
  },
  grid: {
    left: 40,
    right: 16,
    top: 24,
    bottom: 32,
    containLabel: false,
  },
  animationDuration: 800,
  animationEasing: 'cubicOut',
  animationDurationUpdate: 300,
  animationEasingUpdate: 'cubicInOut',
}

export const lightTheme = {
  ...darkTheme,
  color: [
    '#6D28D9', '#15803D', '#1D4ED8', '#92400E', '#B91C1C',
    '#0369A1', '#C2410C', '#4338CA', '#0F766E', '#BE185D',
  ],
  textStyle: { fontFamily: FONT, color: '#475569' },
  title: {
    textStyle: { fontFamily: FONT, color: '#1E293B', fontWeight: 600 },
    subtextStyle: { fontFamily: FONT, color: '#94A3B8' },
  },
  categoryAxis: {
    ...darkTheme.categoryAxis,
    axisLabel: { color: '#64748B', fontSize: 11, fontFamily: FONT },
  },
  valueAxis: {
    ...darkTheme.valueAxis,
    axisLabel: { color: '#64748B', fontSize: 11, fontFamily: FONT },
    splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)', type: 'dashed' } },
  },
  timeAxis: {
    ...darkTheme.timeAxis,
    axisLabel: { color: '#64748B', fontSize: 11, fontFamily: FONT },
  },
  tooltip: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0,0,0,0.1)',
    borderWidth: 1,
    textStyle: { color: '#1E293B', fontSize: 12, fontFamily: FONT },
    extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.1); border-radius: 8px;',
  },
  legend: {
    textStyle: { color: '#475569', fontFamily: FONT, fontSize: 12 },
  },
}
