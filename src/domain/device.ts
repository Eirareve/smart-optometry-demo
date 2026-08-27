export type DeviceConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error'

export type DeviceOperatingState = 'unknown' | 'idle' | 'busy' | 'error'

/** Adapter 返回的标准设备身份信息；厂家相关字段在资料确认前保持可选。 */
export interface DeviceInfo {
  readonly id: string
  readonly name: string
  readonly manufacturer?: string
  readonly model?: string
  readonly serialNumber?: string
  readonly firmwareVersion?: string
}

/** 设备连接及整体空闲、忙碌或错误状态的一次快照，不承载检测阶段。 */
export interface DeviceStatus {
  readonly connectionState: DeviceConnectionState
  readonly operatingState: DeviceOperatingState
  /** ISO 8601 字符串。 */
  readonly observedAt: string
  /** ISO 8601 字符串；尚无成功通信时为 null。 */
  readonly lastCommunicationAt: string | null
  readonly activeExamId?: string
  readonly message?: string
}
