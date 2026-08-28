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

  it('rejects connect_failure without becoming connected', async () => {
    const adapter = createAdapter()
    adapter.setScenario('connect_failure')

    await expect(adapter.connect()).rejects.toMatchObject({
      name: 'DeviceAdapterError',
      code: 'DEVICE_CONNECTION_FAILED',
      message: expect.stringMatching(/Mock\/Demo/),
    })
    await expect(adapter.getStatus()).resolves.toMatchObject({
      connectionState: 'error',
      operatingState: 'unknown',
    })

    expect(adapter.getDiagnosticEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'DEVICE_CONNECT_FAILED',
          message: expect.stringMatching(/Mock\/Demo/),
        }),
      ]),
    )
  })

  it('rejects start_exam_failure without creating a session and can recover', async () => {
    const adapter = await createConnectedAdapter()
    adapter.setScenario('start_exam_failure')

    await expect(adapter.startExam()).rejects.toMatchObject({
      name: 'DeviceAdapterError',
      code: 'EXAM_START_FAILED',
    })
    const statusAfterFailure = await adapter.getStatus()
    expect(statusAfterFailure).toMatchObject({
      connectionState: 'connected',
      operatingState: 'idle',
    })
    expect(statusAfterFailure).not.toHaveProperty('activeExamId')
    expect(
      adapter
        .getDiagnosticEvents()
        .filter(({ type }) => type === 'EXAM_STARTED'),
    ).toHaveLength(0)

    adapter.setScenario('normal')
    await expect(adapter.startExam()).resolves.toMatchObject({
      examId: expect.stringMatching(/^MOCK-EXAM-/),
    })
  })

  it('enters error in exam_error and never returns a result', async () => {
    const adapter = await createConnectedAdapter()
    adapter.setScenario('exam_error')
    const { examId } = await adapter.startExam()

    await expect(adapter.getExamStatus(examId)).resolves.toMatchObject({
      stage: 'preparing',
    })

    vi.advanceTimersByTime(
      FAST_MOCK_DEVICE_TIMING.preparingMs +
        FAST_MOCK_DEVICE_TIMING.leftEyeMs,
    )

    await expect(adapter.getExamStatus(examId)).resolves.toMatchObject({
      stage: 'error',
      progress: null,
      message: expect.stringMatching(/Mock\/Demo/),
    })
    await expect(adapter.getExamResult(examId)).rejects.toMatchObject({
      code: 'EXAM_NOT_COMPLETED',
    })
    await expect(adapter.getStatus()).resolves.toMatchObject({
      operatingState: 'idle',
    })

    expect(adapter.getDiagnosticEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'EXAM_FAILED',
          examId,
          stage: 'error',
        }),
      ]),
    )
  })

  it('rejects status_query_failure without converting it to ExamStatus.error', async () => {
    const adapter = await createConnectedAdapter()
    const { examId } = await adapter.startExam()
    adapter.setScenario('status_query_failure')

    await expect(adapter.getExamStatus(examId)).rejects.toMatchObject({
      name: 'DeviceAdapterError',
      code: 'DEVICE_COMMUNICATION_ERROR',
    })

    expect(adapter.getDiagnosticEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'EXAM_STATUS_QUERY_FAILED',
          examId,
        }),
      ]),
    )
  })

  it('reset restores normal and clears the connection failure state', async () => {
    const adapter = createAdapter()
    adapter.setScenario('connect_failure')
    await expect(adapter.connect()).rejects.toMatchObject({
      code: 'DEVICE_CONNECTION_FAILED',
    })

    adapter.reset()

    expect(adapter.getScenario()).toBe('normal')
    await expect(adapter.getStatus()).resolves.toMatchObject({
      connectionState: 'disconnected',
    })
    await expect(adapter.connect()).resolves.toMatchObject({
      id: 'MOCK-OPT-001',
    })
  })

  it('records connected and exam events with timestamps and examId correlation', async () => {
    const adapter = await createConnectedAdapter()
    const { examId } = await adapter.startExam()

    const events = adapter.getDiagnosticEvents()

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          timestamp: expect.any(String),
          type: 'DEVICE_CONNECTED',
          message: expect.any(String),
        }),
        expect.objectContaining({
          timestamp: expect.any(String),
          type: 'EXAM_STARTED',
          message: expect.any(String),
          examId,
        }),
        expect.objectContaining({
          type: 'EXAM_STAGE_CHANGED',
          examId,
          stage: 'preparing',
        }),
      ]),
    )
    expect(events.every(({ timestamp }) => !Number.isNaN(Date.parse(timestamp)))).toBe(
      true,
    )
  })

  it('keeps only the configured number of most recent diagnostic events', async () => {
    const adapter = new MockDeviceAdapter({
      timing: FAST_MOCK_DEVICE_TIMING,
      diagnosticEventLimit: 5,
    })

    await adapter.connect()
    await adapter.disconnect()
    await adapter.connect()
    await adapter.disconnect()

    const events = adapter.getDiagnosticEvents()

    expect(events).toHaveLength(5)
    expect(events.at(-1)).toMatchObject({ type: 'DEVICE_DISCONNECTED' })

    adapter.clearDiagnosticEvents()
    expect(adapter.getDiagnosticEvents()).toEqual([])
  })
})
