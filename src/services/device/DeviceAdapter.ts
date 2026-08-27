import type {
  DeviceInfo,
  DeviceStatus,
  ExamResult,
  ExamSession,
  ExamStatus,
} from '../../domain'

/**
 * 我方内部的统一设备边界。UI 不直接调用具体设备实现，检测流程由 Exam Service 编排。
 */
export interface DeviceAdapter {
  connect(): Promise<DeviceInfo>
  disconnect(): Promise<void>

  /** 返回调用时刻的一次设备状态快照，不在 Adapter 内持续轮询。 */
  getStatus(): Promise<DeviceStatus>

  /**
   * 创建唯一活动检测。未连接或已有未结束检测时，分别拒绝并返回对应业务错误。
   */
  startExam(): Promise<ExamSession>

  /** 仅取消进行中的检测；成功后该检测的状态必须变为 cancelled。 */
  cancelExam(examId: string): Promise<void>

  /** 返回指定检测在调用时刻的一次状态快照，不在 Adapter 内持续轮询。 */
  getExamStatus(examId: string): Promise<ExamStatus>

  /** 仅在检测为 completed 时返回结果；其他状态不得返回空对象或伪造结果。 */
  getExamResult(examId: string): Promise<ExamResult>
}
