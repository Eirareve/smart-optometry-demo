import type {
  DeviceInfo,
  DeviceStatus,
  ExamResult,
  ExamSession,
  ExamStatus,
} from '../../domain'
import type { DeviceAdapter } from '../device'

export const DEFAULT_EXAM_POLL_INTERVAL_MS = 500

export interface ExamServiceOptions {
  readonly pollIntervalMs?: number
}

/**
 * 检测状态观察者。Adapter 查询失败与 Adapter 返回的 error 终态分开表达：
 * 前者调用 onError，后者仍通过 onStatus 提供标准 ExamStatus。
 */
export interface ExamObserver {
  readonly onStatus: (status: ExamStatus) => void
  readonly onError: (error: unknown) => void
}

interface ExamWatcher {
  readonly observers: Map<ExamObserver, number>
  timer: ReturnType<typeof globalThis.setTimeout> | null
  inFlight: Promise<void> | null
  lastStatus: ExamStatus | null
  generation: number
  paused: boolean
}

const TERMINAL_EXAM_STAGES: ReadonlySet<ExamStatus['stage']> = new Set([
  'completed',
  'cancelled',
  'error',
])

function isTerminalStatus(status: ExamStatus): boolean {
  return TERMINAL_EXAM_STAGES.has(status.stage)
}

function hasMeaningfulStatusChange(
  previous: ExamStatus | null,
  next: ExamStatus,
): boolean {
  return (
    previous === null ||
    previous.stage !== next.stage ||
    previous.progress !== next.progress ||
    previous.message !== next.message
  )
}

/**
 * React UI 与 DeviceAdapter 之间的验光流程编排层。
 *
 * 具体 Adapter 由装配位置注入；本服务不创建 Mock 或真实设备实现，也不生成验光结果。
 */
export class ExamService {
  private readonly adapter: DeviceAdapter
  private readonly pollIntervalMs: number
  private readonly watchers = new Map<string, ExamWatcher>()

  constructor(adapter: DeviceAdapter, options: ExamServiceOptions = {}) {
    const pollIntervalMs =
      options.pollIntervalMs ?? DEFAULT_EXAM_POLL_INTERVAL_MS

    if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) {
      throw new RangeError('pollIntervalMs must be a positive finite number')
    }

    this.adapter = adapter
    this.pollIntervalMs = pollIntervalMs
  }

  connect(): Promise<DeviceInfo> {
    return this.adapter.connect()
  }

  async disconnect(): Promise<void> {
    this.dispose()
    await this.adapter.disconnect()
  }

  getDeviceStatus(): Promise<DeviceStatus> {
    return this.adapter.getStatus()
  }

  startExam(): Promise<ExamSession> {
    return this.adapter.startExam()
  }

  /**
   * 监听指定检测。相同 examId 的订阅共享一条轮询链；返回函数只清理本次订阅。
   */
  watchExam(examId: string, observer: ExamObserver): () => void {
    let watcher = this.watchers.get(examId)
    const isNewWatcher = watcher === undefined

    if (watcher === undefined) {
      watcher = {
        observers: new Map(),
        timer: null,
        inFlight: null,
        lastStatus: null,
        generation: 0,
        paused: false,
      }
      this.watchers.set(examId, watcher)
    }

    const existingSubscriptionCount = watcher.observers.get(observer) ?? 0
    watcher.observers.set(observer, existingSubscriptionCount + 1)

    if (existingSubscriptionCount === 0 && watcher.lastStatus !== null) {
      this.notifyStatusObserver(observer, watcher.lastStatus)
    }

    if (isNewWatcher) {
      void this.pollExam(examId, watcher)
    }

    let isSubscribed = true

    return () => {
      if (!isSubscribed) {
        return
      }

      isSubscribed = false
      const currentWatcher = this.watchers.get(examId)

      if (currentWatcher !== watcher) {
        return
      }

      const subscriptionCount = currentWatcher.observers.get(observer)

      if (subscriptionCount === undefined) {
        return
      }

      if (subscriptionCount === 1) {
        currentWatcher.observers.delete(observer)
      } else {
        currentWatcher.observers.set(observer, subscriptionCount - 1)
      }

      if (currentWatcher.observers.size === 0) {
        this.stopWatcher(examId, currentWatcher)
      }
    }
  }

  /**
   * 主动取消设备检测。若当前有人监听，取消成功后立即读取并发布 Adapter 的终态快照。
   */
  async cancelExam(examId: string): Promise<void> {
    const watcher = this.watchers.get(examId)

    if (watcher !== undefined) {
      this.pauseWatcher(watcher)
    }

    try {
      await this.adapter.cancelExam(examId)
    } catch (error) {
      if (watcher !== undefined) {
        void this.resumeWatcher(examId, watcher)
      }

      throw error
    }

    if (watcher !== undefined) {
      await this.resumeWatcher(examId, watcher)
    }
  }

  /** 结果始终由 Adapter 获取；ExamService 不缓存或生成验光数据。 */
  getExamResult(examId: string): Promise<ExamResult> {
    return this.adapter.getExamResult(examId)
  }

  /** 清理全部状态监听，但不会把设备检测解释为已取消。 */
  dispose(): void {
    for (const [examId, watcher] of this.watchers) {
      this.stopWatcher(examId, watcher)
    }
  }

  private pollExam(examId: string, watcher: ExamWatcher): Promise<void> {
    if (
      this.watchers.get(examId) !== watcher ||
      watcher.paused ||
      watcher.inFlight !== null
    ) {
      return Promise.resolve()
    }

    const generation = watcher.generation
    const operation = this.performPoll(examId, watcher, generation).finally(
      () => {
        if (watcher.inFlight === operation) {
          watcher.inFlight = null
        }
      },
    )

    watcher.inFlight = operation
    return operation
  }

  private async performPoll(
    examId: string,
    watcher: ExamWatcher,
    generation: number,
  ): Promise<void> {
    let status: ExamStatus

    try {
      status = await this.adapter.getExamStatus(examId)
    } catch (error) {
      if (this.isCurrentWatcher(examId, watcher, generation)) {
        this.publishError(examId, watcher, error)
      }

      return
    }

    if (!this.isCurrentWatcher(examId, watcher, generation)) {
      return
    }

    this.publishStatus(examId, watcher, status)

    if (!isTerminalStatus(status)) {
      this.scheduleNextPoll(examId, watcher)
    }
  }

  private scheduleNextPoll(examId: string, watcher: ExamWatcher): void {
    if (this.watchers.get(examId) !== watcher || watcher.paused) {
      return
    }

    watcher.timer = globalThis.setTimeout(() => {
      watcher.timer = null
      void this.pollExam(examId, watcher)
    }, this.pollIntervalMs)
  }

  private publishStatus(
    examId: string,
    watcher: ExamWatcher,
    status: ExamStatus,
  ): void {
    if (!hasMeaningfulStatusChange(watcher.lastStatus, status)) {
      return
    }

    watcher.lastStatus = status
    const observers = [...watcher.observers.keys()]

    if (isTerminalStatus(status)) {
      this.stopWatcher(examId, watcher)
    }

    for (const observer of observers) {
      this.notifyStatusObserver(observer, status)
    }
  }

  private publishError(
    examId: string,
    watcher: ExamWatcher,
    error: unknown,
  ): void {
    const observers = [...watcher.observers.keys()]
    this.stopWatcher(examId, watcher)

    for (const observer of observers) {
      try {
        observer.onError(error)
      } catch (observerError) {
        console.error('ExamService error observer failed', observerError)
      }
    }
  }

  private notifyStatusObserver(
    observer: ExamObserver,
    status: ExamStatus,
  ): void {
    try {
      observer.onStatus(status)
    } catch (error) {
      console.error('ExamService status observer failed', error)
    }
  }

  private pauseWatcher(watcher: ExamWatcher): void {
    watcher.paused = true
    watcher.generation += 1

    if (watcher.timer !== null) {
      globalThis.clearTimeout(watcher.timer)
      watcher.timer = null
    }
  }

  private async resumeWatcher(
    examId: string,
    watcher: ExamWatcher,
  ): Promise<void> {
    const stalePoll = watcher.inFlight

    if (stalePoll !== null) {
      await stalePoll
    }

    if (
      this.watchers.get(examId) !== watcher ||
      watcher.observers.size === 0
    ) {
      return
    }

    watcher.paused = false
    await this.pollExam(examId, watcher)
  }

  private stopWatcher(examId: string, watcher: ExamWatcher): void {
    if (this.watchers.get(examId) !== watcher) {
      return
    }

    watcher.paused = true
    watcher.generation += 1

    if (watcher.timer !== null) {
      globalThis.clearTimeout(watcher.timer)
      watcher.timer = null
    }

    watcher.observers.clear()
    this.watchers.delete(examId)
  }

  private isCurrentWatcher(
    examId: string,
    watcher: ExamWatcher,
    generation: number,
  ): boolean {
    return (
      this.watchers.get(examId) === watcher &&
      !watcher.paused &&
      watcher.generation === generation
    )
  }
}
