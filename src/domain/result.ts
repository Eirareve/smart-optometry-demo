export type ExamDataSource = 'mock' | 'device'

/** 已确认需要展示的单眼屈光数据，不在此定义诊断或处方结论。 */
export interface EyeRefraction {
  readonly sphere: number
  readonly cylinder: number
  readonly axis: number
}

/**
 * 可扩展检测指标。V0.1 的未知项仅使用 metric_01～metric_17 及对应中性显示名。
 */
export interface ExtendedMetric {
  readonly code: string
  readonly displayName: string
  readonly value: string | number
  readonly unit?: string
  readonly status?: 'normal' | 'attention' | 'unknown'
}

/** DeviceAdapter 对上层提供的标准结果，同时保留未经转换的原始返回。 */
export interface ExamResult {
  readonly examId: string
  readonly source: ExamDataSource
  readonly rightEye: EyeRefraction
  readonly leftEye: EyeRefraction
  readonly metrics: readonly ExtendedMetric[]
  readonly rawData: unknown
  /** ISO 8601 字符串。 */
  readonly startedAt: string
  /** ISO 8601 字符串。 */
  readonly completedAt: string
}
