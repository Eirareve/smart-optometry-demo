import type { ExamStage } from '../../domain'

export type MockDiagnosticEventType =
  | 'DEVICE_CONNECT_REQUEST'
  | 'DEVICE_CONNECTED'
  | 'DEVICE_CONNECT_FAILED'
  | 'EXAM_START_REQUEST'
  | 'EXAM_STARTED'
  | 'EXAM_START_FAILED'
  | 'EXAM_STAGE_CHANGED'
  | 'EXAM_CANCELLED'
  | 'EXAM_FAILED'
  | 'EXAM_STATUS_QUERY_FAILED'
  | 'DEVICE_DISCONNECTED'
  | 'MOCK_RESET'

/** 仅描述 Mock 内部行为，不代表厂家原始通信日志。 */
export interface MockDiagnosticEvent {
  readonly timestamp: string
  readonly type: MockDiagnosticEventType
  readonly message: string
  readonly examId?: string
  readonly stage?: ExamStage
}

/**
 * 仅供 Demo / Developer 工具读取 Mock 内存事件。
 * 该接口与正式设备契约分离，且不得记录患者信息。
 */
export interface MockDeviceDiagnostics {
  getDiagnosticEvents(): readonly MockDiagnosticEvent[]
  clearDiagnosticEvents(): void
}

export const DEFAULT_MOCK_DIAGNOSTIC_EVENT_LIMIT = 100
