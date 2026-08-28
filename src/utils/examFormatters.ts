import type { ExamResult, ExtendedMetric } from '../domain'

export function formatDiopter(value: number): string {
  if (!Number.isFinite(value)) {
    return '—'
  }

  const normalizedValue = Object.is(value, -0) ? 0 : value
  const sign = normalizedValue > 0 ? '+' : normalizedValue < 0 ? '-' : ''

  return `${sign}${Math.abs(normalizedValue).toFixed(2)} D`
}

export function formatAxis(value: number): string {
  if (!Number.isFinite(value)) {
    return '—'
  }

  const normalizedValue = Object.is(value, -0) ? 0 : value
  const formattedValue = new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(normalizedValue)

  return `${formattedValue}°`
}

export function formatExamTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)

  if (Number.isNaN(date.getTime())) {
    return isoTimestamp
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatExamSource(source: ExamResult['source']): string {
  return source === 'mock' ? 'Mock Device' : '标准设备数据'
}

export function formatMetricValue(metric: ExtendedMetric): string {
  const value = String(metric.value)

  return metric.unit === undefined || metric.unit.trim() === ''
    ? value
    : `${value} ${metric.unit}`
}

export function formatMetricStatus(metric: ExtendedMetric): string {
  return metric.status === undefined || metric.status === 'unknown'
    ? '待定义'
    : '状态待确认'
}
