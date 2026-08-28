import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ExamStage, ExamStatus } from '../../domain'
import {
  FAST_MOCK_DEVICE_TIMING,
  MockDeviceAdapter,
} from '../device'
import { ExamService, type ExamObserver } from './ExamService'

const BASE_TIME = new Date('2026-08-28T08:00:00.000Z')
const POLL_INTERVAL_MS = 10
const TOTAL_FAST_EXAM_DURATION =
  FAST_MOCK_DEVICE_TIMING.preparingMs +
  FAST_MOCK_DEVICE_TIMING.leftEyeMs +
  FAST_MOCK_DEVICE_TIMING.rightEyeMs +
  FAST_MOCK_DEVICE_TIMING.analyzingMs

interface ObserverRecorder {
  readonly observer: ExamObserver
  readonly statuses: ExamStatus[]
  readonly errors: unknown[]
}

function createObserverRecorder(): ObserverRecorder {
  const statuses: ExamStatus[] = []
  const errors: unknown[] = []

  return {
    observer: {
      onStatus: (status) => statuses.push(status),
      onError: (error) => errors.push(error),
    },
    statuses,
    errors,
  }
}

async function createConnectedService(): Promise<{
  adapter: MockDeviceAdapter
  service: ExamService
}> {
  const adapter = new MockDeviceAdapter({
    timing: FAST_MOCK_DEVICE_TIMING,
  })
  const service = new ExamService(adapter, {
    pollIntervalMs: POLL_INTERVAL_MS,
  })

  await service.connect()

  return { adapter, service }
}

async function flushInitialPoll(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

async function advanceOneStage(): Promise<void> {
  await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
}

function receivedStages(recorder: ObserverRecorder): ExamStage[] {
  return recorder.statuses.map(({ stage }) => stage)
}

describe('ExamService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE_TIME)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('advances through the complete exam workflow with MockDeviceAdapter', async () => {
    const { service } = await createConnectedService()
    const session = await service.startExam()
    const recorder = createObserverRecorder()

    const cleanup = service.watchExam(session.examId, recorder.observer)

    await flushInitialPoll()
    await advanceOneStage()
    await advanceOneStage()
    await advanceOneStage()
    await advanceOneStage()

    expect(receivedStages(recorder)).toEqual([
      'preparing',
      'left_eye',
      'right_eye',
      'analyzing',
      'completed',
    ])
    expect(recorder.errors).toEqual([])

    cleanup()
  })

  it('stops polling after completed', async () => {
    const { adapter, service } = await createConnectedService()
    const session = await service.startExam()
    const recorder = createObserverRecorder()
    const getExamStatus = vi.spyOn(adapter, 'getExamStatus')

    service.watchExam(session.examId, recorder.observer)

    await flushInitialPoll()
    await advanceOneStage()
    await advanceOneStage()
    await advanceOneStage()
    await advanceOneStage()

    const callsAtCompletion = getExamStatus.mock.calls.length

    expect(receivedStages(recorder).at(-1)).toBe('completed')

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10)

    expect(getExamStatus).toHaveBeenCalledTimes(callsAtCompletion)
  })

  it('publishes cancelled and stops polling after active cancellation', async () => {
    const { adapter, service } = await createConnectedService()
    const session = await service.startExam()
    const recorder = createObserverRecorder()
    const getExamStatus = vi.spyOn(adapter, 'getExamStatus')

    service.watchExam(session.examId, recorder.observer)
    await flushInitialPoll()

    await service.cancelExam(session.examId)

    const callsAtCancellation = getExamStatus.mock.calls.length

    expect(receivedStages(recorder)).toEqual(['preparing', 'cancelled'])

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10)

    expect(getExamStatus).toHaveBeenCalledTimes(callsAtCancellation)
  })

  it('publishes the Adapter error terminal state and stops polling', async () => {
    const { adapter, service } = await createConnectedService()
    const session = await service.startExam()
    const recorder = createObserverRecorder()
    const getExamStatus = vi.spyOn(adapter, 'getExamStatus')

    service.watchExam(session.examId, recorder.observer)
    await flushInitialPoll()

    await adapter.disconnect()
    await advanceOneStage()

    const callsAtError = getExamStatus.mock.calls.length

    expect(receivedStages(recorder)).toEqual(['preparing', 'error'])
    expect(recorder.errors).toEqual([])

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10)

    expect(getExamStatus).toHaveBeenCalledTimes(callsAtError)
  })

  it('reports a status query rejection and stops polling', async () => {
    const { adapter, service } = await createConnectedService()
    const session = await service.startExam()
    const recorder = createObserverRecorder()
    const queryError = new Error('Mock status query failed')
    const getExamStatus = vi
      .spyOn(adapter, 'getExamStatus')
      .mockRejectedValueOnce(queryError)

    service.watchExam(session.examId, recorder.observer)
    await flushInitialPoll()

    expect(recorder.statuses).toEqual([])
    expect(recorder.errors).toEqual([queryError])

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10)

    expect(getExamStatus).toHaveBeenCalledTimes(1)
  })

  it('stops polling and callbacks after cleanup', async () => {
    const { adapter, service } = await createConnectedService()
    const session = await service.startExam()
    const recorder = createObserverRecorder()
    const getExamStatus = vi.spyOn(adapter, 'getExamStatus')
    const cleanup = service.watchExam(session.examId, recorder.observer)

    await flushInitialPoll()

    const callsAtCleanup = getExamStatus.mock.calls.length
    const statusesAtCleanup = recorder.statuses.length

    cleanup()
    cleanup()
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10)

    expect(getExamStatus).toHaveBeenCalledTimes(callsAtCleanup)
    expect(recorder.statuses).toHaveLength(statusesAtCleanup)
  })

  it('shares one polling loop across repeated watchers for the same exam', async () => {
    const { adapter, service } = await createConnectedService()
    const session = await service.startExam()
    const firstRecorder = createObserverRecorder()
    const secondRecorder = createObserverRecorder()
    const getExamStatus = vi.spyOn(adapter, 'getExamStatus')

    const cleanupFirst = service.watchExam(
      session.examId,
      firstRecorder.observer,
    )
    await flushInitialPoll()

    const cleanupSecond = service.watchExam(
      session.examId,
      secondRecorder.observer,
    )

    expect(getExamStatus).toHaveBeenCalledTimes(1)
    expect(receivedStages(secondRecorder)).toEqual(['preparing'])

    await advanceOneStage()

    expect(getExamStatus).toHaveBeenCalledTimes(2)
    expect(receivedStages(firstRecorder)).toEqual(['preparing', 'left_eye'])
    expect(receivedStages(secondRecorder)).toEqual(['preparing', 'left_eye'])

    cleanupFirst()
    await advanceOneStage()

    expect(getExamStatus).toHaveBeenCalledTimes(3)
    expect(receivedStages(firstRecorder)).toEqual(['preparing', 'left_eye'])
    expect(receivedStages(secondRecorder)).toEqual([
      'preparing',
      'left_eye',
      'right_eye',
    ])

    cleanupSecond()
    const callsAfterLastCleanup = getExamStatus.mock.calls.length
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10)

    expect(getExamStatus).toHaveBeenCalledTimes(callsAfterLastCleanup)
  })

  it('does not overlap status queries when one poll is still pending', async () => {
    const { adapter, service } = await createConnectedService()
    const session = await service.startExam()
    const firstStatus = await adapter.getExamStatus(session.examId)
    let resolvePendingPoll: ((status: ExamStatus) => void) | undefined
    const pendingPoll = new Promise<ExamStatus>((resolve) => {
      resolvePendingPoll = resolve
    })
    const getExamStatus = vi
      .spyOn(adapter, 'getExamStatus')
      .mockImplementationOnce(() => pendingPoll)
    const recorder = createObserverRecorder()
    const cleanup = service.watchExam(session.examId, recorder.observer)

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10)

    expect(getExamStatus).toHaveBeenCalledTimes(1)

    resolvePendingPoll?.(firstStatus)
    await flushInitialPoll()

    expect(receivedStages(recorder)).toEqual(['preparing'])

    cleanup()
  })

  it('delegates completed result retrieval to DeviceAdapter', async () => {
    const { adapter, service } = await createConnectedService()
    const session = await service.startExam()
    const getExamResult = vi.spyOn(adapter, 'getExamResult')

    vi.advanceTimersByTime(TOTAL_FAST_EXAM_DURATION)

    const result = await service.getExamResult(session.examId)

    expect(getExamResult).toHaveBeenCalledWith(session.examId)
    expect(result).toMatchObject({
      examId: session.examId,
      source: 'mock',
      rawData: {
        source: 'mock',
        demo: true,
      },
    })
  })

  it('validates the polling interval', () => {
    const adapter = new MockDeviceAdapter()

    expect(
      () => new ExamService(adapter, { pollIntervalMs: 0 }),
    ).toThrow(RangeError)
    expect(
      () => new ExamService(adapter, { pollIntervalMs: Number.NaN }),
    ).toThrow(RangeError)
  })
})
