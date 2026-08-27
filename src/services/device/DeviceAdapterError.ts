/** 我方 DeviceAdapter 的稳定业务错误码，不对应任何厂家私有错误码。 */
export type DeviceAdapterErrorCode =
  | 'DEVICE_NOT_CONNECTED'
  | 'DEVICE_BUSY'
  | 'EXAM_NOT_FOUND'
  | 'EXAM_NOT_COMPLETED'
  | 'EXAM_ALREADY_FINISHED'

/** 具体 Adapter 用于显式报告可预期业务失败的简单错误类型。 */
export class DeviceAdapterError extends Error {
  readonly code: DeviceAdapterErrorCode

  constructor(code: DeviceAdapterErrorCode, message: string) {
    super(message)
    this.name = 'DeviceAdapterError'
    this.code = code
  }
}
