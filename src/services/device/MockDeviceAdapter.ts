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
import type { DeviceAdapterErrorCode } from './DeviceAdapterError'
import type {
  MockDeviceControl,
  MockDeviceScenario,
} from './MockDeviceControl'
import {
  DEFAULT_MOCK_DIAGNOSTIC_EVENT_LIMIT,
  type MockDeviceDiagnostics,
  type MockDiagnosticEvent,
} from './MockDeviceDiagnostics'

export interface MockDeviceTiming {
  readonly connectDelayMs: number
  readonly preparingMs: number
  readonly leftEyeMs: number
  readonly rightEyeMs: number
  readonly analyzingMs: number
}

export interface MockDeviceAdapterOptions {
  readonly timing?: Partial<MockDeviceTiming>
  readonly initialScenario?: MockDeviceScenario
  readonly diagnosticEventLimit?: number
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

const MOCK_DEVICE_SCENARIOS: ReadonlySet<MockDeviceScenario> = new Set([
  'normal',
  'connect_failure',
  'start_exam_failure',
  'exam_error',
  'status_query_failure',
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
  lastDiagnosticStage?: ExamStage
}

interface ResolvedExamState {
  readonly stage: ExamStage
  readonly progress: number | null
  readonly updatedAtMs: number
  readonly message: string
}

type MockDiagnosticEventInput = Omit<MockDiagnosticEvent, 'timestamp'> & {
  readonly timestamp?: string
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

function validateDiagnosticEventLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new RangeError('diagnosticEventLimit must be a positive integer')
  }
}

/**
 * V0.1 的纯内存模拟设备。它不调用任何厂家 SDK、API 或真实硬件。
 */
export class MockDeviceAdapter
  implements DeviceAdapter, MockDeviceControl, MockDeviceDiagnostics
{
  private readonly timing: MockDeviceTiming
  private readonly diagnosticEventLimit: number
  private readonly exams = new Map<string, MockExamRecord>()
  private readonly diagnosticEvents: MockDiagnosticEvent[] = []

  private connectionState: DeviceStatus['connectionState'] = 'disconnected'
  private lastCommunicationAt: string | null = null
  private activeExamId: string | null = null
  private connectionAttempt = 0
  private scenario: MockDeviceScenario

  constructor(options: MockDeviceAdapterOptions = {}) {
    this.timing = {
      ...DEFAULT_MOCK_DEVICE_TIMING,
      ...options.timing,
    }
    validateTiming(this.timing)

    this.diagnosticEventLimit =
      options.diagnosticEventLimit ?? DEFAULT_MOCK_DIAGNOSTIC_EVENT_LIMIT
    validateDiagnosticEventLimit(this.diagnosticEventLimit)

    this.scenario = options.initialScenario ?? 'normal'
    this.assertScenario(this.scenario)
  }

  getScenario(): MockDeviceScenario {
    return this.scenario
  }

  setScenario(scenario: MockDeviceScenario): void {
    this.assertScenario(scenario)
    this.scenario = scenario
  }

  reset(): void {
    this.scenario = 'normal'

    if (
      this.connectionState === 'error' ||
      this.connectionState === 'connecting'
    ) {
      this.connectionAttempt += 1
      this.connectionState = 'disconnected'
      this.lastCommunicationAt = null
    }

    this.appendDiagnosticEvent({
      type: 'MOCK_RESET',
      message: 'Mock/Demo 故障控制已恢复为 normal',
    })
  }

  getDiagnosticEvents(): readonly MockDiagnosticEvent[] {
    return this.diagnosticEvents.map((event) => ({ ...event }))
  }

  clearDiagnosticEvents(): void {
    this.diagnosticEvents.length = 0
  }

  async connect(): Promise<DeviceInfo> {
    this.appendDiagnosticEvent({
      type: 'DEVICE_CONNECT_REQUEST',
      message: '收到 Mock/Demo 设备连接请求',
    })

    if (this.connectionState === 'connected') {
      this.lastCommunicationAt = new Date().toISOString()
      this.appendDiagnosticEvent({
        type: 'DEVICE_CONNECTED',
        message: 'Mock/Demo 设备已处于连接状态',
      })
      return { ...MOCK_DEVICE_INFO }
    }

    const connectionAttempt = ++this.connectionAttempt
    this.connectionState = 'connecting'
    await wait(this.timing.connectDelayMs)

    if (
      connectionAttempt !== this.connectionAttempt ||
      this.connectionState !== 'connecting'
    ) {
      const error = new DeviceAdapterError(
        'DEVICE_CONNECTION_FAILED',
        'Mock/Demo 设备连接已取消',
      )
      this.appendDiagnosticEvent({
        type: 'DEVICE_CONNECT_FAILED',
        message: error.message,
      })
      throw error
    }

    if (this.scenario === 'connect_failure') {
      this.connectionState = 'error'
      this.lastCommunicationAt = null

      const error = new DeviceAdapterError(
        'DEVICE_CONNECTION_FAILED',
        'Mock/Demo 故障场景：模拟设备连接失败',
      )
      this.appendDiagnosticEvent({
        type: 'DEVICE_CONNECT_FAILED',
        message: error.message,
      })
      throw error
    }

    this.connectionState = 'connected'
    this.lastCommunicationAt = new Date().toISOString()
    this.appendDiagnosticEvent({
      type: 'DEVICE_CONNECTED',
      message: 'Mock/Demo 设备连接成功',
    })

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
        this.recordExamStageDiagnostics(
          activeExam,
          record,
          this.resolveExamState(record, nowMs),
        )
      }

      this.activeExamId = null
    }

    if (this.connectionState === 'connected') {
      this.lastCommunicationAt = new Date(nowMs).toISOString()
    }

    this.connectionState = 'disconnected'
    this.appendDiagnosticEvent({
      type: 'DEVICE_DISCONNECTED',
      message: 'Mock/Demo 设备已断开',
    })
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
    this.appendDiagnosticEvent({
      type: 'EXAM_START_REQUEST',
      message: '收到 Mock/Demo 模拟检测启动请求',
    })

    if (this.connectionState !== 'connected') {
      throw this.createStartExamError(
        'DEVICE_NOT_CONNECTED',
        'Mock/Demo 设备尚未连接，无法开始模拟检测',
      )
    }

    const startedAtMs = Date.now()

    if (this.resolveActiveExam(startedAtMs) !== null) {
      throw this.createStartExamError(
        'DEVICE_BUSY',
        'Mock/Demo 设备已有正在进行的模拟检测',
      )
    }

    if (this.scenario === 'start_exam_failure') {
      throw this.createStartExamError(
        'EXAM_START_FAILED',
        'Mock/Demo 故障场景：模拟检测启动失败',
      )
    }

    const session: ExamSession = {
      examId: createExamId(startedAtMs),
      startedAt: new Date(startedAtMs).toISOString(),
    }

    const record: MockExamRecord = {
      session,
      startedAtMs,
    }

    this.exams.set(session.examId, record)
    this.activeExamId = session.examId
    this.lastCommunicationAt = session.startedAt
    const initialState = this.resolveExamState(record, startedAtMs)
    this.appendDiagnosticEvent({
      type: 'EXAM_STARTED',
      message: 'Mock/Demo 模拟检测已创建',
      examId: session.examId,
      stage: initialState.stage,
    })
    this.recordExamStageDiagnostics(
      session.examId,
      record,
      initialState,
    )

    return { ...session }
  }

  async cancelExam(examId: string): Promise<void> {
    const record = this.getExamRecord(examId)
    const nowMs = Date.now()
    const state = this.resolveAndRecordExamState(examId, record, nowMs)

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
    this.recordExamStageDiagnostics(
      examId,
      record,
      this.resolveExamState(record, nowMs),
    )

    if (this.activeExamId === examId) {
      this.activeExamId = null
    }

    this.touchCommunication(nowMs)
  }

  async getExamStatus(examId: string): Promise<ExamStatus> {
    const record = this.getExamRecord(examId)
    const nowMs = Date.now()

    if (this.scenario === 'status_query_failure') {
      const error = new DeviceAdapterError(
        'DEVICE_COMMUNICATION_ERROR',
        'Mock/Demo 故障场景：模拟检测状态查询失败',
      )
      this.appendDiagnosticEvent({
        type: 'EXAM_STATUS_QUERY_FAILED',
        message: error.message,
        examId,
      })
      throw error
    }

    const state = this.resolveAndRecordExamState(examId, record, nowMs)

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
    const state = this.resolveAndRecordExamState(examId, record, nowMs)

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

    if (record === undefined) {
      this.activeExamId = null
      return this.activeExamId
    }

    const state = this.resolveAndRecordExamState(
      this.activeExamId,
      record,
      nowMs,
    )

    if (!isActiveExamStage(state.stage)) {
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

    if (this.scenario === 'exam_error' && elapsedMs >= leftEyeEndsAt) {
      record.terminalState = {
        stage: 'error',
        occurredAtMs: record.startedAtMs + leftEyeEndsAt,
        message:
          'Mock/Demo 故障场景：模拟检测在进入右眼采集阶段时失败',
      }

      return {
        stage: 'error',
        progress: null,
        updatedAtMs: record.terminalState.occurredAtMs,
        message: record.terminalState.message,
      }
    }

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

  private resolveAndRecordExamState(
    examId: string,
    record: MockExamRecord,
    nowMs: number,
  ): ResolvedExamState {
    const state = this.resolveExamState(record, nowMs)
    this.recordExamStageDiagnostics(examId, record, state)
    return state
  }

  private recordExamStageDiagnostics(
    examId: string,
    record: MockExamRecord,
    state: ResolvedExamState,
  ): void {
    if (record.lastDiagnosticStage === state.stage) {
      return
    }

    record.lastDiagnosticStage = state.stage
    const timestamp = new Date(state.updatedAtMs).toISOString()

    this.appendDiagnosticEvent({
      timestamp,
      type: 'EXAM_STAGE_CHANGED',
      message: `Mock/Demo 模拟检测阶段变更为 ${state.stage}`,
      examId,
      stage: state.stage,
    })

    if (state.stage === 'cancelled') {
      this.appendDiagnosticEvent({
        timestamp,
        type: 'EXAM_CANCELLED',
        message: state.message,
        examId,
        stage: state.stage,
      })
    }

    if (state.stage === 'error') {
      this.appendDiagnosticEvent({
        timestamp,
        type: 'EXAM_FAILED',
        message: state.message,
        examId,
        stage: state.stage,
      })
    }
  }

  private createStartExamError(
    code: Extract<
      DeviceAdapterErrorCode,
      'DEVICE_NOT_CONNECTED' | 'DEVICE_BUSY' | 'EXAM_START_FAILED'
    >,
    message: string,
  ): DeviceAdapterError {
    this.appendDiagnosticEvent({
      type: 'EXAM_START_FAILED',
      message,
    })
    return new DeviceAdapterError(code, message)
  }

  private appendDiagnosticEvent(event: MockDiagnosticEventInput): void {
    const { timestamp = new Date().toISOString(), ...details } = event

    this.diagnosticEvents.push({ timestamp, ...details })

    const overflow =
      this.diagnosticEvents.length - this.diagnosticEventLimit

    if (overflow > 0) {
      this.diagnosticEvents.splice(0, overflow)
    }
  }

  private assertScenario(scenario: MockDeviceScenario): void {
    if (!MOCK_DEVICE_SCENARIOS.has(scenario)) {
      throw new RangeError(`Unknown Mock/Demo scenario: ${scenario}`)
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

    if (this.connectionState === 'error') {
      return 'Mock/Demo 设备连接失败'
    }

    if (operatingState === 'busy') {
      return 'Mock/Demo 设备正在执行模拟检测'
    }

    return 'Mock/Demo 设备已连接并就绪'
  }
}
