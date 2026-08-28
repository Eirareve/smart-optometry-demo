import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { ExamResult } from '../domain'
import {
  DeviceAdapterError,
  FAST_MOCK_DEVICE_TIMING,
  MockDeviceAdapter,
} from '../services/device'
import { ExamService } from '../services/exam'
import { AppDependenciesProvider } from './AppDependenciesProvider'
import { AppRoutes } from './router'

const EXAM_ID = 'EX-DEMO-RESULT-001'

function createExamResult(
  overrides: Partial<ExamResult> = {},
): ExamResult {
  return {
    examId: EXAM_ID,
    source: 'mock',
    rightEye: {
      sphere: -2.5,
      cylinder: -0.75,
      axis: 175,
    },
    leftEye: {
      sphere: -2.75,
      cylinder: -0.5,
      axis: 10,
    },
    metrics: Array.from({ length: 17 }, (_, index) => {
      const sequence = String(index + 1).padStart(2, '0')

      return {
        code: `metric_${sequence}`,
        displayName: `扩展检测指标 ${sequence}`,
        value: `FROM-RESULT-${sequence}`,
        status: 'unknown' as const,
      }
    }),
    rawData: {
      hiddenSentinel: 'RAW-DATA-SHOULD-NOT-RENDER',
    },
    startedAt: '2026-08-28T08:00:00.000Z',
    completedAt: '2026-08-28T08:00:06.000Z',
    ...overrides,
  }
}

function createExamService(): ExamService {
  return new ExamService(
    new MockDeviceAdapter({ timing: FAST_MOCK_DEVICE_TIMING }),
    { pollIntervalMs: 10 },
  )
}

function renderResult(examService: ExamService, examId = EXAM_ID) {
  return render(
    <AppDependenciesProvider dependencies={{ examService }}>
      <MemoryRouter
        initialEntries={[`/results/${encodeURIComponent(examId)}`]}
      >
        <AppRoutes />
      </MemoryRouter>
    </AppDependenciesProvider>,
  )
}

describe('ResultPage', () => {
  it('loads a completed ExamResult and renders OD, OS, metadata, and mock source', async () => {
    const examService = createExamService()
    const result = createExamResult()
    const getExamResult = vi
      .spyOn(examService, 'getExamResult')
      .mockResolvedValue(result)

    renderResult(examService)

    expect(
      await screen.findByRole('heading', { name: '本次模拟检测已完成' }),
    ).toBeInTheDocument()
    expect(getExamResult).toHaveBeenCalledTimes(1)
    expect(getExamResult).toHaveBeenCalledWith(EXAM_ID)
    expect(
      screen.getByRole('heading', { name: '智能验光结果' }),
    ).toBeInTheDocument()
    expect(screen.getByText('DEMO MODE')).toBeInTheDocument()
    expect(screen.getAllByText('模拟数据').length).toBeGreaterThan(0)
    expect(screen.getByText(EXAM_ID)).toBeInTheDocument()
    expect(screen.getByText('Mock Device')).toBeInTheDocument()
    expect(screen.getByText('检测开始时间')).toBeInTheDocument()
    expect(screen.getByText('检测完成时间')).toBeInTheDocument()

    const rightEye = screen.getByTestId('eye-result-od')
    const leftEye = screen.getByTestId('eye-result-os')

    expect(within(rightEye).getByText('OD')).toBeInTheDocument()
    expect(within(rightEye).getByText('-2.50 D')).toBeInTheDocument()
    expect(within(rightEye).getByText('-0.75 D')).toBeInTheDocument()
    expect(within(rightEye).getByText('175°')).toBeInTheDocument()
    expect(within(leftEye).getByText('OS')).toBeInTheDocument()
    expect(within(leftEye).getByText('-2.75 D')).toBeInTheDocument()
    expect(within(leftEye).getByText('-0.50 D')).toBeInTheDocument()
    expect(within(leftEye).getByText('10°')).toBeInTheDocument()
  })

  it('formats positive, zero, negative, and fractional refraction values', async () => {
    const examService = createExamService()
    const result = createExamResult({
      rightEye: {
        sphere: 1.25,
        cylinder: 0,
        axis: 12.5,
      },
      leftEye: {
        sphere: -1,
        cylinder: -0,
        axis: 180,
      },
    })

    vi.spyOn(examService, 'getExamResult').mockResolvedValue(result)
    renderResult(examService)

    const rightEye = await screen.findByTestId('eye-result-od')
    const leftEye = screen.getByTestId('eye-result-os')

    expect(within(rightEye).getByText('+1.25 D')).toBeInTheDocument()
    expect(within(rightEye).getByText('0.00 D')).toBeInTheDocument()
    expect(within(rightEye).getByText('12.5°')).toBeInTheDocument()
    expect(within(leftEye).getByText('-1.00 D')).toBeInTheDocument()
    expect(within(leftEye).getByText('0.00 D')).toBeInTheDocument()
    expect(within(leftEye).getByText('180°')).toBeInTheDocument()
  })

  it('renders all 17 metrics directly from ExamResult without exposing rawData', async () => {
    const examService = createExamService()
    const result = createExamResult()

    vi.spyOn(examService, 'getExamResult').mockResolvedValue(result)
    renderResult(examService)

    await screen.findByRole('heading', { name: '扩展检测指标' })

    expect(screen.getAllByRole('listitem')).toHaveLength(17)

    for (const metric of result.metrics) {
      expect(screen.getByText(metric.displayName)).toBeInTheDocument()
      expect(screen.getByText(String(metric.value))).toBeInTheDocument()
    }

    expect(screen.getAllByText('待定义')).toHaveLength(17)
    expect(
      screen.queryByText('RAW-DATA-SHOULD-NOT-RENDER'),
    ).not.toBeInTheDocument()
  })

  it('shows a clear loading state while getExamResult is pending', () => {
    const examService = createExamService()

    vi.spyOn(examService, 'getExamResult').mockReturnValue(
      new Promise<ExamResult>(() => undefined),
    )
    renderResult(examService)

    expect(screen.getByRole('status')).toHaveTextContent('正在读取验光结果')
    expect(screen.queryByTestId('eye-result-od')).not.toBeInTheDocument()
  })

  it('shows a missing-record error for an unknown examId', async () => {
    const examService = createExamService()

    vi.spyOn(examService, 'getExamResult').mockRejectedValue(
      new DeviceAdapterError('EXAM_NOT_FOUND', 'missing'),
    )
    renderResult(examService, 'missing-exam')

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent('无法读取本次检测结果')
    expect(alert).toHaveTextContent('当前模拟检测记录已不存在')
    expect(alert).toHaveTextContent('请返回首页重新检测')
    expect(screen.queryByTestId('eye-result-od')).not.toBeInTheDocument()
  })

  it('rejects result access when the exam is not completed', async () => {
    const examService = createExamService()

    vi.spyOn(examService, 'getExamResult').mockRejectedValue(
      new DeviceAdapterError('EXAM_NOT_COMPLETED', 'not completed'),
    )
    renderResult(examService, 'active-exam')

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent('检测尚未完成')
    expect(alert).toHaveTextContent('不能提前生成模拟结果')
    expect(
      screen.getByRole('button', { name: '返回检测页面' }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('eye-result-od')).not.toBeInTheDocument()
  })
})
