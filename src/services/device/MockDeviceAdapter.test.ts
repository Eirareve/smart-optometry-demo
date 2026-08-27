import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  FAST_MOCK_DEVICE_TIMING,
  MockDeviceAdapter,
  type MockDeviceTiming,
} from './MockDeviceAdapter'

const BASE_TIME = new Date('2026-08-28T08:00:00.000Z')

const TOTAL_FAST_EXAM_DURATION =
  FAST_MOCK_DEVICE_TIMING.preparingMs +
  FAST_MOCK_DEVICE_TIMING.leftEyeMs +
  FAST_MOCK_DEVICE_TIMING.rightEyeMs +
  FAST_MOCK_DEVICE_TIMING.analyzingMs

function createAdapter(
  timing: Readonly<MockDeviceTiming> = FAST_MOCK_DEVICE_TIMING,
): MockDeviceAdapter {
  return new MockDeviceAdapter({ timing })
}

async function createConnectedAdapter(): Promise<MockDeviceAdapter> {
  const adapter = createAdapter()
  await adapter.connect()
  return adapter
}

describe('MockDeviceAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE_TIME)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts disconnected', async () => {
    const adapter = createAdapter()

    await expect(adapter.getStatus()).resolves.toMatchObject({
      connectionState: 'disconnected',
      operatingState: 'unknown',
      lastCommunicationAt: null,
      message: expect.stringMatching(/Mock\/Demo/),
    })
  })

  it('connects after the configured Demo delay and becomes ready', async () => {
    const adapter = createAdapter({
      ...FAST_MOCK_DEVICE_TIMING,
      connectDelayMs: 25,
    })

    const connection = adapter.connect()

    await expect(adapter.getStatus()).resolves.toMatchObject({
      connectionState: 'connecting',
      operatingState: 'unknown',
    })

    await vi.advanceTimersByTimeAsync(25)

    await expect(connection).resolves.toEqual({
      id: 'MOCK-OPT-001',
      name: 'Smart Optometry Mock Device',
    })
    await expect(adapter.getStatus()).resolves.toMatchObject({
      connectionState: 'connected',
      operatingState: 'idle',
      message: expect.stringMatching(/Mock\/Demo.*就绪/),
    })
  })

  it('disconnects a connected Mock device', async () => {
    const adapter = await createConnectedAdapter()

    await adapter.disconnect()

    await expect(adapter.getStatus()).resolves.toMatchObject({
      connectionState: 'disconnected',
      operatingState: 'unknown',
    })
  })

  it('stays disconnected when disconnect interrupts a pending connection', async () => {
    const adapter = createAdapter({
      ...FAST_MOCK_DEVICE_TIMING,
      connectDelayMs: 25,
    })
    const connection = adapter.connect()
    const connectionFailure = expect(connection).rejects.toThrow(
      'Mock/Demo 设备连接已取消',
    )

    await adapter.disconnect()
    await vi.advanceTimersByTimeAsync(25)

    await connectionFailure
    await expect(adapter.getStatus()).resolves.toMatchObject({
      connectionState: 'disconnected',
      operatingState: 'unknown',
    })
  })

  it('rejects startExam while disconnected', async () => {
    const adapter = createAdapter()

    await expect(adapter.startExam()).rejects.toMatchObject({
      name: 'DeviceAdapterError',
      code: 'DEVICE_NOT_CONNECTED',
    })
  })

  it('starts an exam with a unique examId and ISO startedAt', async () => {
    const adapter = await createConnectedAdapter()

    const firstSession = await adapter.startExam()
    vi.advanceTimersByTime(TOTAL_FAST_EXAM_DURATION)
    const secondSession = await adapter.startExam()

    expect(firstSession.examId).toMatch(/^MOCK-EXAM-/)
    expect(secondSession.examId).toMatch(/^MOCK-EXAM-/)
    expect(secondSession.examId).not.toBe(firstSession.examId)
    expect(firstSession.startedAt).toBe(BASE_TIME.toISOString())
  })

  it('rejects a second active exam with DEVICE_BUSY', async () => {
    const adapter = await createConnectedAdapter()
    const session = await adapter.startExam()

    await expect(adapter.startExam()).rejects.toMatchObject({
      name: 'DeviceAdapterError',
      code: 'DEVICE_BUSY',
    })
    await expect(adapter.getStatus()).resolves.toMatchObject({
      operatingState: 'busy',
      activeExamId: session.examId,
    })
  })

  it('advances through every exam stage and completes by elapsed time', async () => {
    const adapter = await createConnectedAdapter()
    const { examId } = await adapter.startExam()

    await expect(adapter.getExamStatus(examId)).resolves.toMatchObject({
      stage: 'preparing',
      progress: 10,
    })

    vi.advanceTimersByTime(FAST_MOCK_DEVICE_TIMING.preparingMs)
    await expect(adapter.getExamStatus(examId)).resolves.toMatchObject({
      stage: 'left_eye',
      progress: 35,
    })

    vi.advanceTimersByTime(FAST_MOCK_DEVICE_TIMING.leftEyeMs)
    await expect(adapter.getExamStatus(examId)).resolves.toMatchObject({
      stage: 'right_eye',
      progress: 65,
    })

    vi.advanceTimersByTime(FAST_MOCK_DEVICE_TIMING.rightEyeMs)
    await expect(adapter.getExamStatus(examId)).resolves.toMatchObject({
      stage: 'analyzing',
      progress: 90,
    })

    vi.advanceTimersByTime(FAST_MOCK_DEVICE_TIMING.analyzingMs)
    await expect(adapter.getExamStatus(examId)).resolves.toMatchObject({
      stage: 'completed',
      progress: 100,
    })
    await expect(adapter.getStatus()).resolves.toMatchObject({
      operatingState: 'idle',
    })
  })

  it('returns the completed Demo refraction result', async () => {
    const adapter = await createConnectedAdapter()
    const session = await adapter.startExam()
    vi.advanceTimersByTime(TOTAL_FAST_EXAM_DURATION)

    await expect(adapter.getExamResult(session.examId)).resolves.toMatchObject({
      examId: session.examId,
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
      startedAt: session.startedAt,
      completedAt: new Date(
        BASE_TIME.getTime() + TOTAL_FAST_EXAM_DURATION,
      ).toISOString(),
    })
  })

  it('rejects getExamResult before completion', async () => {
    const adapter = await createConnectedAdapter()
    const { examId } = await adapter.startExam()

    await expect(adapter.getExamResult(examId)).rejects.toMatchObject({
      name: 'DeviceAdapterError',
      code: 'EXAM_NOT_COMPLETED',
    })
  })

  it('cancels an active exam and releases the device', async () => {
    const adapter = await createConnectedAdapter()
    const { examId } = await adapter.startExam()

    await adapter.cancelExam(examId)

    await expect(adapter.getExamStatus(examId)).resolves.toMatchObject({
      stage: 'cancelled',
      progress: null,
    })
    await expect(adapter.getStatus()).resolves.toMatchObject({
      operatingState: 'idle',
    })
    await expect(adapter.getExamResult(examId)).rejects.toMatchObject({
      code: 'EXAM_NOT_COMPLETED',
    })
  })

  it('rejects cancellation after a cancelled or completed exam', async () => {
    const adapter = await createConnectedAdapter()
    const cancelledSession = await adapter.startExam()
    await adapter.cancelExam(cancelledSession.examId)

    await expect(
      adapter.cancelExam(cancelledSession.examId),
    ).rejects.toMatchObject({
      code: 'EXAM_ALREADY_FINISHED',
    })

    const completedSession = await adapter.startExam()
    vi.advanceTimersByTime(TOTAL_FAST_EXAM_DURATION)

    await expect(
      adapter.cancelExam(completedSession.examId),
    ).rejects.toMatchObject({
      code: 'EXAM_ALREADY_FINISHED',
    })
  })

  it('returns EXAM_NOT_FOUND for unknown exam ids', async () => {
    const adapter = await createConnectedAdapter()

    await expect(adapter.getExamStatus('missing-exam')).rejects.toMatchObject({
      code: 'EXAM_NOT_FOUND',
    })
    await expect(adapter.cancelExam('missing-exam')).rejects.toMatchObject({
      code: 'EXAM_NOT_FOUND',
    })
    await expect(adapter.getExamResult('missing-exam')).rejects.toMatchObject({
      code: 'EXAM_NOT_FOUND',
    })
  })

  it('returns 17 neutral metrics, mock source, and preserved rawData', async () => {
    const adapter = await createConnectedAdapter()
    const { examId } = await adapter.startExam()
    vi.advanceTimersByTime(TOTAL_FAST_EXAM_DURATION)

    const result = await adapter.getExamResult(examId)

    expect(result.source).toBe('mock')
    expect(result.metrics).toHaveLength(17)
    expect(result.metrics).toEqual(
      Array.from({ length: 17 }, (_, index) => {
        const sequence = String(index + 1).padStart(2, '0')

        return {
          code: `metric_${sequence}`,
          displayName: `扩展检测指标 ${sequence}`,
          value: `DEMO-${sequence}`,
          status: 'unknown',
        }
      }),
    )
    expect(result.rawData).toMatchObject({
      source: 'mock',
      demo: true,
      exam: { examId },
    })
  })
})
