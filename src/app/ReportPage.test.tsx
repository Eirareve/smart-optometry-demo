import { fireEvent, render, screen, within } from '@testing-library/react'
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

const EXAM_ID = 'EX-DEMO-REPORT-001'

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
      sphere: 1.25,
      cylinder: 0,
      axis: 10,
    },
    metrics: [
      {
        code: 'metric_03',
        displayName: '扩展检测指标 03',
        value: 'REPORT-VALUE-03',
        status: 'unknown',
      },
      {
        code: 'metric_11',
        displayName: '扩展检测指标 11',
        value: 11,
        unit: 'DEMO-UNIT',
        status: 'unknown',
      },
    ],
    rawData: {
      hiddenSentinel: 'REPORT-RAW-DATA-SHOULD-NOT-RENDER',
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

function renderReport(examService: ExamService, examId = EXAM_ID) {
  return render(
    <AppDependenciesProvider dependencies={{ examService }}>
      <MemoryRouter initialEntries={[`/report/${encodeURIComponent(examId)}`]}>
        <AppRoutes />
      </MemoryRouter>
    </AppDependenciesProvider>,
  )
}

describe('ReportPage', () => {
  it('opens a completed exam report through ExamService and shows its metadata', async () => {
    const examService = createExamService()
    const result = createExamResult()
    const getExamResult = vi
      .spyOn(examService, 'getExamResult')
      .mockResolvedValue(result)

    renderReport(examService)

    expect(
      await screen.findByRole('heading', { level: 2, name: '智能验光报告' }),
    ).toBeInTheDocument()
    expect(getExamResult).toHaveBeenCalledTimes(1)
    expect(getExamResult).toHaveBeenCalledWith(EXAM_ID)
    expect(screen.getByText(`DEMO-RPT-${EXAM_ID}`)).toBeInTheDocument()
    expect(screen.getByText(EXAM_ID)).toBeInTheDocument()
    expect(screen.getByText('Mock Device')).toBeInTheDocument()
    expect(screen.getByText('检测开始时间')).toBeInTheDocument()
    expect(screen.getByText('检测完成时间')).toBeInTheDocument()
  })

  it('renders the right and left eye values with shared report formatting', async () => {
    const examService = createExamService()

    vi.spyOn(examService, 'getExamResult').mockResolvedValue(
      createExamResult(),
    )
    renderReport(examService)

    const table = await screen.findByRole('table', {
      name: '左右眼核心屈光结果',
    })

    expect(within(table).getByText('右眼 OD')).toBeInTheDocument()
    expect(within(table).getByText('左眼 OS')).toBeInTheDocument()
    expect(within(table).getByText('-2.50 D')).toBeInTheDocument()
    expect(within(table).getByText('-0.75 D')).toBeInTheDocument()
    expect(within(table).getByText('175°')).toBeInTheDocument()
    expect(within(table).getByText('+1.25 D')).toBeInTheDocument()
    expect(within(table).getByText('0.00 D')).toBeInTheDocument()
    expect(within(table).getByText('10°')).toBeInTheDocument()
  })

  it('renders only the metrics supplied by ExamResult and keeps unknown status neutral', async () => {
    const examService = createExamService()
    const result = createExamResult()

    vi.spyOn(examService, 'getExamResult').mockResolvedValue(result)
    renderReport(examService)

    const table = await screen.findByRole('table', { name: '扩展检测指标' })

    expect(within(table).getAllByRole('row')).toHaveLength(
      result.metrics.length + 1,
    )
    expect(within(table).getByText('metric_03')).toBeInTheDocument()
    expect(within(table).getByText('REPORT-VALUE-03')).toBeInTheDocument()
    expect(within(table).getByText('metric_11')).toBeInTheDocument()
    expect(within(table).getByText('11 DEMO-UNIT')).toBeInTheDocument()
    expect(within(table).getAllByText('待定义')).toHaveLength(2)
    expect(within(table).queryByText('metric_17')).not.toBeInTheDocument()
  })

  it('keeps the mock-data disclaimer and report actions visible', async () => {
    const examService = createExamService()

    vi.spyOn(examService, 'getExamResult').mockResolvedValue(
      createExamResult(),
    )
    renderReport(examService)

    expect(
      await screen.findByText(
        '本报告当前使用模拟设备数据，仅用于智能验光软件原型、交互流程及设备接入架构验证，不构成医疗诊断、验光处方、疾病筛查或治疗建议。',
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByText('DEMO MODE').length).toBeGreaterThan(0)
    expect(screen.getAllByText('模拟数据').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', { name: '打印报告' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '返回验光结果' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '返回首页' }),
    ).toBeInTheDocument()
  })

  it('calls the native browser print function', async () => {
    const examService = createExamService()
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    vi.spyOn(examService, 'getExamResult').mockResolvedValue(
      createExamResult(),
    )
    renderReport(examService)

    fireEvent.click(
      await screen.findByRole('button', { name: '打印报告' }),
    )

    expect(print).toHaveBeenCalledTimes(1)
    print.mockRestore()
  })

  it('shows a clear loading state while the result request is pending', () => {
    const examService = createExamService()

    vi.spyOn(examService, 'getExamResult').mockReturnValue(
      new Promise<ExamResult>(() => undefined),
    )
    renderReport(examService)

    expect(screen.getByRole('status')).toHaveTextContent(
      '正在生成电子验光报告',
    )
    expect(
      screen.queryByRole('table', { name: '左右眼核心屈光结果' }),
    ).not.toBeInTheDocument()
  })

  it('shows the required message when the exam record does not exist', async () => {
    const examService = createExamService()

    vi.spyOn(examService, 'getExamResult').mockRejectedValue(
      new DeviceAdapterError('EXAM_NOT_FOUND', 'missing'),
    )
    renderReport(examService, 'missing-exam')

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent('无法生成本次验光报告')
    expect(alert).toHaveTextContent(
      '当前模拟检测记录已不存在，请返回首页重新检测。',
    )
    expect(
      screen.queryByRole('button', { name: '打印报告' }),
    ).not.toBeInTheDocument()
  })

  it('does not generate a report before the exam is completed', async () => {
    const examService = createExamService()

    vi.spyOn(examService, 'getExamResult').mockRejectedValue(
      new DeviceAdapterError('EXAM_NOT_COMPLETED', 'not completed'),
    )
    renderReport(examService, 'active-exam')

    const alert = await screen.findByRole('alert')

    expect(alert).toHaveTextContent('本次检测尚未完成，无法生成报告。')
    expect(
      screen.getByRole('button', { name: '返回检测页面' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '返回首页' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '打印报告' }),
    ).not.toBeInTheDocument()
  })

  it('does not read or render ExamResult.rawData', async () => {
    const examService = createExamService()
    const result = createExamResult()

    Object.defineProperty(result, 'rawData', {
      configurable: true,
      get: () => {
        throw new Error('ReportPage accessed rawData')
      },
    })
    vi.spyOn(examService, 'getExamResult').mockResolvedValue(result)
    renderReport(examService)

    expect(
      await screen.findByRole('heading', { level: 2, name: '智能验光报告' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('REPORT-RAW-DATA-SHOULD-NOT-RENDER'),
    ).not.toBeInTheDocument()
  })
})
