import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  FAST_MOCK_DEVICE_TIMING,
  MockDeviceAdapter,
} from '../services/device'
import { ExamService } from '../services/exam'
import { AppDependenciesProvider } from './AppDependenciesProvider'
import { AppRoutes } from './router'

const BASE_TIME = new Date('2026-08-28T08:00:00.000Z')
const POLL_INTERVAL_MS = 10

async function createConnectedExam() {
  const adapter = new MockDeviceAdapter({
    timing: FAST_MOCK_DEVICE_TIMING,
  })
  const examService = new ExamService(adapter, {
    pollIntervalMs: POLL_INTERVAL_MS,
  })

  await examService.connect()
  const session = await examService.startExam()

  return {
    adapter,
    examService,
    session,
  }
}

function renderExam(examService: ExamService, examId: string) {
  return render(
    <AppDependenciesProvider dependencies={{ examService }}>
      <MemoryRouter initialEntries={[`/exam/${encodeURIComponent(examId)}`]}>
        <AppRoutes />
      </MemoryRouter>
    </AppDependenciesProvider>,
  )
}

async function advanceExamTime(milliseconds: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds)
  })
}

describe('ExamPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE_TIME)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders every live stage, progress, and eye analysis status', async () => {
    const { examService, session } = await createConnectedExam()

    renderExam(examService, session.examId)
    await advanceExamTime(0)

    expect(
      screen.getByRole('heading', { name: '设备准备' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '10',
    )
    expect(screen.getByTestId('left-eye-status')).toHaveTextContent('等待中')
    expect(screen.getByTestId('right-eye-status')).toHaveTextContent('等待中')
    expect(screen.getByTestId('analysis-status')).toHaveTextContent('等待中')
    expect(screen.getByText(session.examId)).toBeInTheDocument()
    expect(screen.getByText('DEMO MODE')).toBeInTheDocument()

    await advanceExamTime(POLL_INTERVAL_MS)

    expect(
      screen.getByRole('heading', { level: 1, name: '左眼检测' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('left-eye-status')).toHaveTextContent('进行中')

    await advanceExamTime(POLL_INTERVAL_MS)

    expect(
      screen.getByRole('heading', { level: 1, name: '右眼检测' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('left-eye-status')).toHaveTextContent('已完成')
    expect(screen.getByTestId('right-eye-status')).toHaveTextContent('进行中')

    await advanceExamTime(POLL_INTERVAL_MS)

    expect(
      screen.getByRole('heading', { level: 1, name: '数据分析' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('right-eye-status')).toHaveTextContent('已完成')
    expect(screen.getByTestId('analysis-status')).toHaveTextContent('进行中')

    await advanceExamTime(POLL_INTERVAL_MS)

    expect(
      screen.getByRole('heading', { name: '检测完成' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100',
    )
    expect(screen.getByTestId('analysis-status')).toHaveTextContent('已完成')
    expect(screen.getByText(/暂不展示检测结果或报告/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '返回首页' }),
    ).toBeInTheDocument()
  })

  it('cancels through ExamService and allows returning home', async () => {
    const { examService, session } = await createConnectedExam()
    const cancelExam = vi.spyOn(examService, 'cancelExam')

    renderExam(examService, session.examId)
    await advanceExamTime(0)

    fireEvent.click(screen.getByRole('button', { name: '取消检测' }))
    await advanceExamTime(0)

    expect(
      screen.getByRole('heading', { name: '检测已取消' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('left-eye-status')).toHaveTextContent('已取消')
    expect(screen.getByTestId('right-eye-status')).toHaveTextContent('已取消')
    expect(screen.getByTestId('analysis-status')).toHaveTextContent('已取消')
    expect(cancelExam).toHaveBeenCalledWith(session.examId)

    fireEvent.click(screen.getByRole('button', { name: '返回首页' }))

    expect(
      screen.getByRole('heading', { name: '智能验光系统' }),
    ).toBeInTheDocument()
  })

  it('renders an Adapter error terminal state without navigating away', async () => {
    const { adapter, examService, session } = await createConnectedExam()

    renderExam(examService, session.examId)
    await advanceExamTime(0)

    await act(async () => {
      await adapter.disconnect()
    })
    await advanceExamTime(POLL_INTERVAL_MS)

    expect(
      screen.getByRole('heading', { name: '检测异常' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Mock/Demo 检测因模拟设备断开而结束',
    )
    expect(screen.getByTestId('analysis-status')).toHaveTextContent('异常')
    expect(
      screen.getByRole('button', { name: '返回首页' }),
    ).toBeInTheDocument()
  })

  it('shows a clear error when a refreshed in-memory exam id is missing', async () => {
    const adapter = new MockDeviceAdapter({
      timing: FAST_MOCK_DEVICE_TIMING,
    })
    const examService = new ExamService(adapter, {
      pollIntervalMs: POLL_INTERVAL_MS,
    })

    await examService.connect()
    renderExam(examService, 'missing-exam')
    await advanceExamTime(0)

    expect(
      screen.getByRole('heading', { name: '检测异常' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      '当前内存中不存在这条检测记录',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('页面刷新后')
    expect(
      screen.getByRole('button', { name: '返回首页' }),
    ).toBeInTheDocument()
  })

  it('runs the ExamService subscription cleanup when unmounted', async () => {
    const adapter = new MockDeviceAdapter({
      timing: FAST_MOCK_DEVICE_TIMING,
    })
    const examService = new ExamService(adapter, {
      pollIntervalMs: POLL_INTERVAL_MS,
    })
    const cleanup = vi.fn()
    const watchExam = vi
      .spyOn(examService, 'watchExam')
      .mockReturnValue(cleanup)

    const view = renderExam(examService, 'cleanup-exam')

    expect(watchExam).toHaveBeenCalledWith(
      'cleanup-exam',
      expect.objectContaining({
        onStatus: expect.any(Function),
        onError: expect.any(Function),
      }),
    )

    view.unmount()

    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
