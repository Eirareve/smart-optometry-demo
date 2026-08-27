export type ExamStage =
  | 'preparing'
  | 'left_eye'
  | 'right_eye'
  | 'analyzing'
  | 'completed'
  | 'cancelled'
  | 'error'

/** 设备接受 startExam 后创建的检测会话。 */
export interface ExamSession {
  readonly examId: string
  /** ISO 8601 字符串。 */
  readonly startedAt: string
}

/** 单次检测阶段的一次快照；progress 为 0～100，无法提供时为 null。 */
export interface ExamStatus {
  readonly examId: string
  readonly stage: ExamStage
  readonly progress: number | null
  /** ISO 8601 字符串。 */
  readonly updatedAt: string
  readonly message?: string
}
