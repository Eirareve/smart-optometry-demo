import { describe, expect, it } from 'vitest'

import {
  formatAxis,
  formatDiopter,
  formatExamSource,
  formatExamTime,
  formatMetricStatus,
  formatMetricValue,
} from './examFormatters'

describe('examFormatters', () => {
  it('formats diopters with signs, two decimals, zero normalization, and invalid fallback', () => {
    expect(formatDiopter(-2.5)).toBe('-2.50 D')
    expect(formatDiopter(1.25)).toBe('+1.25 D')
    expect(formatDiopter(0)).toBe('0.00 D')
    expect(formatDiopter(-0)).toBe('0.00 D')
    expect(formatDiopter(Number.NaN)).toBe('—')
  })

  it('formats axes without unnecessary decimals and handles invalid values', () => {
    expect(formatAxis(175)).toBe('175°')
    expect(formatAxis(12.5)).toBe('12.5°')
    expect(formatAxis(-0)).toBe('0°')
    expect(formatAxis(Number.POSITIVE_INFINITY)).toBe('—')
  })

  it('formats valid exam times and preserves invalid timestamps', () => {
    expect(formatExamTime('2026-08-28T08:00:00.000Z')).toContain('2026')
    expect(formatExamTime('not-an-iso-time')).toBe('not-an-iso-time')
  })

  it('formats source and metric values without adding medical meaning', () => {
    expect(formatExamSource('mock')).toBe('Mock Device')
    expect(formatExamSource('device')).toBe('标准设备数据')
    expect(
      formatMetricValue({
        code: 'metric_01',
        displayName: '扩展检测指标 01',
        value: 1,
        unit: 'DEMO-UNIT',
        status: 'unknown',
      }),
    ).toBe('1 DEMO-UNIT')
    expect(
      formatMetricStatus({
        code: 'metric_01',
        displayName: '扩展检测指标 01',
        value: 'DEMO',
        status: 'unknown',
      }),
    ).toBe('待定义')
  })
})
