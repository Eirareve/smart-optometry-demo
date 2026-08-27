import type {
  DeviceInfo,
  DeviceStatus,
  ExamResult,
  ExamSession,
  ExamStage,
  ExamStatus,
  ExtendedMetric,
} from '../../domain'

import type { DeviceAdapter } from './DeviceAdapter'
import { DeviceAdapterError } from './DeviceAdapterError'

export interface MockDeviceTiming {
  readonly connectDelayMs: number
  readonly preparingMs: number
  readonly leftEyeMs: number
  readonly rightEyeMs: number
  readonly analyzingMs: number
}

export interface MockDeviceAdapterOptions {
  readonly timing?: Partial<MockDeviceTiming>
}

/** 普通 Demo 的集中时间配置，总检测时长为 6 秒。 */
export const DEFAULT_MOCK_DEVICE_TIMING: Readonly<MockDeviceTiming> =
  Object.freeze({
    connectDelayMs: 350,
    preparingMs: 1_000,
    leftEyeMs: 2_000,
    rightEyeMs: 2_000,
    analyzingMs: 1_000,
  })

/** 单元测试或快速演示使用的时间配置。 */
export const FAST_MOCK_DEVICE_TIMING: Readonly<MockDeviceTiming> =
  Object.freeze({
    connectDelayMs: 0,
    preparingMs: 10,
    leftEyeMs: 10,
    rightEyeMs: 10,
    analyzingMs: 10,
  })

const MOCK_DEVICE_INFO: Readonly<DeviceInfo> = Object.freeze({
  id: 'MOCK-OPT-001',
  name: 'Smart Optometry Mock Device',
})

const ACTIVE_EXAM_STAGES: ReadonlySet<ExamStage> = new Set([
  'preparing',
  'left_eye',
  'right_eye',
  'analyzing',
])

type TerminalExamStage = Extract<ExamStage, 'cancelled' | 'error'>

interface TerminalExamState {
  readonly stage: TerminalExamStage
  readonly occurredAtMs: number
  readonly message: string
}

interface MockExamRecord {
  readonly session: ExamSession
  readonly startedAtMs: number
  terminalState?: TerminalExamState
}

interface ResolvedExamState {
  readonly stage: ExamStage
  readonly progress: number | null
  readonly updatedAtMs: number
  readonly message: string
}

let nextExamSequence = 0

function createExamId(startedAtMs: number): string {
  nextExamSequence += 1

  return `MOCK-EXAM-${startedAtMs}-${String(nextExamSequence).padStart(4, '0')}`
}

function wait(delayMs: number): Promise<void> {
  if (delayMs === 0) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs)
  })
}

function isActiveExamStage(stage: ExamStage): boolean {
  return ACTIVE_EXAM_STAGES.has(stage)
}

function createExtendedMetrics(): readonly ExtendedMetric[] {
  return Array.from({ length: 17 }, (_, index) => {
    const sequence = String(index + 1).padStart(2, '0')

    return {
      code: `metric_${sequence}`,
      displayName: `扩展检测指标 ${sequence}`,
      value: `DEMO-${sequence}`,
      status: 'unknown' as const,
    }
  })
}

function validateTiming(timing: MockDeviceTiming): void {
  for (const [name, value] of Object.entries(timing)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} must be a non-negative finite number`)
    }
  }
}

/**
 * V0.1 的纯内存模拟设备。它不调用任何厂家 SDK、API 或真实硬件。
 */
export class MockDeviceAdapter implements DeviceAdapter {
  private readonly timing: MockDeviceTiming
  private readonly exams = new Map<string, MockExamRecord>()

  private connectionState: DeviceStatus['connectionState'] = 'disconnected'
  private lastCommunicationAt: string | null = null
  private activeExamId: string | null = null
  private connectionAttempt = 0

  constructor(options: MockDeviceAdapterOptions = {}) {
    this.timing = {
      ...DEFAULT_MOCK_DEVICE_TIMING,
      ...options.timing,
    }
    validateTiming(this.timing)
  }

  async connect(): Promise<DeviceInfo> {
    if (this.connectionState === 'connected') {
      this.lastCommunicationAt = new Date().toISOString()
      return { ...MOCK_DEVICE_INFO }
    }

    const connectionAttempt = ++this.connectionAttempt
    this.connectionState = 'connecting'
    await wait(this.timing.connectDelayMs)

    if (
      connectionAttempt !== this.connectionAttempt ||
      this.connectionState !== 'connecting'
    ) {
      throw new Error('Mock/Demo 设备连接已取消')
    }

    this.connectionState = 'connected'
    this.lastCommunicationAt = new Date().toISOString()

    return { ...MOCK_DEVICE_INFO }
  }

  async disconnect(): Promise<void> {
    const nowMs = Date.now()
    const activeExam = this.resolveActiveExam(nowMs)

    this.connectionAttempt += 1

    if (activeExam !== null) {
      const record = this.exams.get(activeExam)

      if (record !== undefined) {
        record.terminalState = {
          stage: 'error',
          occurredAtMs: nowMs,
          message: 'Mock/Demo 检测因模拟设备断开而结束',
        }
      }

      this.activeExamId = null
    }

    if (this.connectionState === 'connected') {
      this.lastCommunicationAt = new Date(nowMs).toISOString()
    }

    this.connectionState = 'disconnected'
  }

  async getStatus(): Promise<DeviceStatus> {
    const nowMs = Date.now()
    const observedAt = new Date(nowMs).toISOString()
    const activeExamId = this.resolveActiveExam(nowMs)
    const isConnected = this.connectionState === 'connected'

    if (isConnected) {
      this.lastCommunicationAt = observedAt
    }

    const operatingState: DeviceStatus['operatingState'] = isConnected
      ? activeExamId === null
        ? 'idle'
        : 'busy'
      : 'unknown'

    return {
      connectionState: this.connectionState,
      operatingState,
      observedAt,
      lastCommunicationAt: this.lastCommunicationAt,
      ...(activeExamId === null ? {} : { activeExamId }),
      message: this.createDeviceStatusMessage(operatingState),
    }
  }

  async startExam(): Promise<ExamSession> {
    if (this.connectionState !== 'connected') {
      throw new DeviceAdapterError(
        'DEVICE_NOT_CONNECTED',
        'Mock/Demo 设备尚未连接，无法开始模拟检测',
      )
    }

    const startedAtMs = Date.now()

    if (this.resolveActiveExam(startedAtMs) !== null) {
      throw new DeviceAdapterError(
        'DEVICE_BUSY',
        'Mock/Demo 设备已有正在进行的模拟检测',
      )
    }

    const session: ExamSession = {
      examId: createExamId(startedAtMs),
      startedAt: new Date(startedAtMs).toISOString(),
    }

    this.exams.set(session.examId, {
      session,
      startedAtMs,
    })
    this.activeExamId = session.examId
    this.lastCommunicationAt = session.startedAt

    return { ...session }
  }

  async cancelExam(examId: string): Promise<void> {
    const record = this.getExamRecord(examId)
    const nowMs = Date.now()
    const state = this.resolveExamState(record, nowMs)

    if (!isActiveExamStage(state.stage)) {
      throw new DeviceAdapterError(
        'EXAM_ALREADY_FINISHED',
        `模拟检测 ${examId} 已结束，不能再次取消`,
      )
    }

    record.terminalState = {
      stage: 'cancelled',
      occurredAtMs: nowMs,
      message: 'Mock/Demo 模拟检测已取消',
    }

    if (this.activeExamId === examId) {
      this.activeExamId = null
    }

    this.touchCommunication(nowMs)
  }

  async getExamStatus(examId: string): Promise<ExamStatus> {
    const record = this.getExamRecord(examId)
    const nowMs = Date.now()
    const state = this.resolveExamState(record, nowMs)

    if (!isActiveExamStage(state.stage) && this.activeExamId === examId) {
      this.activeExamId = null
    }

    this.touchCommunication(nowMs)

    return {
      examId,
      stage: state.stage,
      progress: state.progress,
      updatedAt: new Date(state.updatedAtMs).toISOString(),
      message: state.message,
    }
  }

  async getExamResult(examId: string): Promise<ExamResult> {
    const record = this.getExamRecord(examId)
    const nowMs = Date.now()
    const state = this.resolveExamState(record, nowMs)

    if (state.stage !== 'completed') {
      throw new DeviceAdapterError(
        'EXAM_NOT_COMPLETED',
        `模拟检测 ${examId} 尚未完成，不能读取结果`,
      )
    }

    if (this.activeExamId === examId) {
      this.activeExamId = null
    }

    this.touchCommunication(nowMs)

    const completedAtMs = record.startedAtMs + this.totalExamDurationMs
    const completedAt = new Date(completedAtMs).toISOString()
    const metrics = createExtendedMetrics()
    const rightEye = {
      sphere: -2.5,
      cylinder: -0.75,
      axis: 175,
    }
    const leftEye = {
      sphere: -2.75,
      cylinder: -0.5,
      axis: 10,
    }

    return {
      examId,
      source: 'mock',
      rightEye,
      leftEye,
      metrics,
      rawData: {
        source: 'mock',
        demo: true,
        format: 'smart-optometry-demo/mock-result-v1',
        device: {
          id: MOCK_DEVICE_INFO.id,
          name: MOCK_DEVICE_INFO.name,
        },
        exam: {
          examId,
          startedAt: record.session.startedAt,
          completedAt,
        },
        readings: {
          OD: {
            SPH: rightEye.sphere,
            CYL: rightEye.cylinder,
            AXIS: rightEye.axis,
          },
          OS: {
            SPH: leftEye.sphere,
            CYL: leftEye.cylinder,
            AXIS: leftEye.axis,
          },
        },
        extendedMetrics: metrics.map(({ code, value }) => ({ code, value })),
      },
      startedAt: record.session.startedAt,
      completedAt,
    }
  }

  private get totalExamDurationMs(): number {
    return (
      this.timing.preparingMs +
      this.timing.leftEyeMs +
      this.timing.rightEyeMs +
      this.timing.analyzingMs
    )
  }

  private getExamRecord(examId: string): MockExamRecord {
    const record = this.exams.get(examId)

    if (record === undefined) {
      throw new DeviceAdapterError(
        'EXAM_NOT_FOUND',
        `未找到模拟检测 ${examId}`,
      )
    }

    return record
  }

  private resolveActiveExam(nowMs: number): string | null {
    if (this.activeExamId === null) {
      return null
    }

    const record = this.exams.get(this.activeExamId)

    if (
      record === undefined ||
      !isActiveExamStage(this.resolveExamState(record, nowMs).stage)
    ) {
      this.activeExamId = null
    }

    return this.activeExamId
  }

  private resolveExamState(
    record: MockExamRecord,
    nowMs: number,
  ): ResolvedExamState {
    if (record.terminalState !== undefined) {
      return {
        stage: record.terminalState.stage,
        progress: null,
        updatedAtMs: record.terminalState.occurredAtMs,
        message: record.terminalState.message,
      }
    }

    const elapsedMs = Math.max(0, nowMs - record.startedAtMs)
    const preparingEndsAt = this.timing.preparingMs
    const leftEyeEndsAt = preparingEndsAt + this.timing.leftEyeMs
    const rightEyeEndsAt = leftEyeEndsAt + this.timing.rightEyeMs
    const analyzingEndsAt = rightEyeEndsAt + this.timing.analyzingMs

    if (elapsedMs < preparingEndsAt) {
      return {
        stage: 'preparing',
        progress: 10,
        updatedAtMs: nowMs,
        message: 'Mock/Demo 模拟设备准备中',
      }
    }

    if (elapsedMs < leftEyeEndsAt) {
      return {
        stage: 'left_eye',
        progress: 35,
        updatedAtMs: nowMs,
        message: 'Mock/Demo 左眼模拟数据采集中',
      }
    }

    if (elapsedMs < rightEyeEndsAt) {
      return {
        stage: 'right_eye',
        progress: 65,
        updatedAtMs: nowMs,
        message: 'Mock/Demo 右眼模拟数据采集中',
      }
    }

    if (elapsedMs < analyzingEndsAt) {
      return {
        stage: 'analyzing',
        progress: 90,
        updatedAtMs: nowMs,
        message: 'Mock/Demo 模拟数据分析中',
      }
    }

    return {
      stage: 'completed',
      progress: 100,
      updatedAtMs: record.startedAtMs + this.totalExamDurationMs,
      message: 'Mock/Demo 模拟检测已完成',
    }
  }

  private touchCommunication(nowMs: number): void {
    if (this.connectionState === 'connected') {
      this.lastCommunicationAt = new Date(nowMs).toISOString()
    }
  }

  private createDeviceStatusMessage(
    operatingState: DeviceStatus['operatingState'],
  ): string {
    if (this.connectionState === 'connecting') {
      return 'Mock/Demo 设备正在模拟连接'
    }

    if (this.connectionState === 'disconnected') {
      return 'Mock/Demo 设备已断开'
    }

    if (operatingState === 'busy') {
      return 'Mock/Demo 设备正在执行模拟检测'
    }

    return 'Mock/Demo 设备已连接并就绪'
  }
}
