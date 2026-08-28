import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useAppDependencies } from '../app/dependencies'
import type { ExamStage, ExamStatus } from '../domain'
import { DeviceAdapterError } from '../services/device'

const STAGE_LABELS: Readonly<Record<ExamStage, string>> = {
  preparing: '设备准备',
  left_eye: '左眼检测',
  right_eye: '右眼检测',
  analyzing: '数据分析',
  completed: '检测完成',
  cancelled: '检测已取消',
  error: '检测异常',
}

type ExamStep = Extract<ExamStage, 'left_eye' | 'right_eye' | 'analyzing'>
type StepState = 'pending' | 'active' | 'completed' | 'cancelled' | 'error'

const EXAM_STEPS: readonly {
  readonly stage: ExamStep
  readonly title: string
  readonly description: string
  readonly testId: string
}[] = [
  {
    stage: 'left_eye',
    title: '左眼检测',
    description: 'OS · 模拟数据采集',
    testId: 'left-eye-status',
  },
  {
    stage: 'right_eye',
    title: '右眼检测',
    description: 'OD · 模拟数据采集',
    testId: 'right-eye-status',
  },
  {
    stage: 'analyzing',
    title: '数据分析',
    description: '模拟检测数据处理',
    testId: 'analysis-status',
  },
]

const STEP_LABELS: Readonly<Record<StepState, string>> = {
  pending: '等待中',
  active: '进行中',
  completed: '已完成',
  cancelled: '已取消',
  error: '异常',
}

function getErrorMessage(error: unknown): string {
  if (
    error instanceof DeviceAdapterError &&
    error.code === 'EXAM_NOT_FOUND'
  ) {
    return '当前内存中不存在这条检测记录。页面刷新后，Mock Device 的内存会话可能已经清空，请返回首页重新开始。'
  }

  if (error instanceof Error && error.message.trim() !== '') {
    return error.message
  }

  return '发生未知错误，请返回首页后重试。'
}

function getStepState(
  step: ExamStep,
  stage: ExamStage | null,
  hasObserverError: boolean,
): StepState {
  if (hasObserverError || stage === 'error') {
    return 'error'
  }

  if (stage === 'cancelled') {
    return 'cancelled'
  }

  if (stage === 'completed') {
    return 'completed'
  }

  if (stage === null || stage === 'preparing') {
    return 'pending'
  }

  const activeStepIndex = EXAM_STEPS.findIndex(
    ({ stage: examStage }) => examStage === stage,
  )
  const stepIndex = EXAM_STEPS.findIndex(
    ({ stage: examStage }) => examStage === step,
  )

  if (stepIndex < activeStepIndex) {
    return 'completed'
  }

  return stepIndex === activeStepIndex ? 'active' : 'pending'
}

function ExamScanner({ stage }: { readonly stage: ExamStage | null }) {
  const isActive =
    stage === 'preparing' ||
    stage === 'left_eye' ||
    stage === 'right_eye' ||
    stage === 'analyzing'

  return (
    <div
      className={`exam-scanner${isActive ? ' exam-scanner--active' : ''}`}
      aria-hidden="true"
    >
      <span className="exam-scanner__orbit exam-scanner__orbit--outer" />
      <span className="exam-scanner__orbit exam-scanner__orbit--inner" />
      <span className="exam-scanner__eye">
        <span className="exam-scanner__iris" />
      </span>
      <span className="exam-scanner__beam" />
    </div>
  )
}

export function ExamPage() {
  const { examId: routeExamId } = useParams<'examId'>()
  const examId = routeExamId?.trim() ?? ''
  const { examService } = useAppDependencies()
  const navigate = useNavigate()
  const [status, setStatus] = useState<ExamStatus | null>(null)
  const [progressSnapshot, setProgressSnapshot] = useState({
    examId: '',
    value: 0,
  })
  const [observerFailure, setObserverFailure] = useState<{
    readonly examId: string
    readonly message: string
  } | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const lifecycleVersionRef = useRef(0)

  useEffect(() => {
    const lifecycleVersion = ++lifecycleVersionRef.current

    if (examId === '') {
      return () => {
        lifecycleVersionRef.current += 1
      }
    }

    const cleanup = examService.watchExam(examId, {
      onStatus: (nextStatus) => {
        if (lifecycleVersionRef.current !== lifecycleVersion) {
          return
        }

        setStatus(nextStatus)
        setObserverFailure(null)

        if (nextStatus.progress !== null) {
          setProgressSnapshot({
            examId,
            value: nextStatus.progress,
          })
        }
      },
      onError: (error) => {
        if (lifecycleVersionRef.current !== lifecycleVersion) {
          return
        }

        setObserverFailure({
          examId,
          message: getErrorMessage(error),
        })
      },
    })

    return () => {
      lifecycleVersionRef.current += 1
      cleanup()
    }
  }, [examId, examService])

  const currentStatus = status?.examId === examId ? status : null
  const displayProgress =
    progressSnapshot.examId === examId ? progressSnapshot.value : 0
  const observerError =
    examId === ''
      ? '检测编号缺失，请返回首页重新开始。'
      : observerFailure?.examId === examId
        ? observerFailure.message
        : null
  const stage =
    observerError === null ? (currentStatus?.stage ?? null) : 'error'
  const isActiveStage =
    stage === 'preparing' ||
    stage === 'left_eye' ||
    stage === 'right_eye' ||
    stage === 'analyzing'
  const isTerminalStage =
    stage === 'completed' || stage === 'cancelled' || stage === 'error'

  const handleCancel = async () => {
    if (!isActiveStage || isCancelling || examId === '') {
      return
    }

    const lifecycleVersion = lifecycleVersionRef.current

    setIsCancelling(true)
    setCancelError(null)

    try {
      await examService.cancelExam(examId)
    } catch (error) {
      if (lifecycleVersionRef.current !== lifecycleVersion) {
        return
      }

      setCancelError(`取消检测失败：${getErrorMessage(error)}`)
    } finally {
      if (lifecycleVersionRef.current === lifecycleVersion) {
        setIsCancelling(false)
      }
    }
  }

  const currentStageLabel =
    stage === null ? '正在读取检测状态' : STAGE_LABELS[stage]
  const statusMessage =
    observerError ??
    currentStatus?.message ??
    '正在从验光流程服务读取 Mock/Demo 检测状态…'

  return (
    <div className={`exam-shell exam-shell--${stage ?? 'loading'}`}>
      <div className="ambient-glow ambient-glow--top" aria-hidden="true" />
      <div className="ambient-glow ambient-glow--bottom" aria-hidden="true" />

      <header className="exam-topbar">
        <div>
          <p className="brand__english">SMART OPTOMETRY</p>
          <p className="exam-topbar__title">智能验光检测</p>
        </div>
        <span className="demo-mode">
          <span className="demo-mode__pulse" aria-hidden="true" />
          DEMO MODE
        </span>
      </header>

      <main className="exam-main">
        <section className="exam-focus" aria-labelledby="exam-stage-title">
          <div className="exam-focus__heading">
            <div>
              <p className="section-kicker">LIVE EXAM WORKFLOW</p>
              <h1 id="exam-stage-title">{currentStageLabel}</h1>
            </div>
            <span className={`exam-stage-chip exam-stage-chip--${stage ?? 'loading'}`}>
              <span aria-hidden="true" />
              {stage === null ? '同步中' : stage.toUpperCase()}
            </span>
          </div>

          <ExamScanner stage={stage} />

          <p
            className="exam-status-message"
            role={stage === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {statusMessage}
          </p>

          {stage === 'completed' ? (
            <p className="exam-terminal-note">
              检测完成。本阶段暂不展示检测结果或报告。
            </p>
          ) : null}
          {stage === 'cancelled' ? (
            <p className="exam-terminal-note">
              本次模拟检测已安全停止，可返回首页重新开始。
            </p>
          ) : null}
        </section>

        <aside className="exam-panel" aria-label="检测进度详情">
          <div className="exam-id-block">
            <span>检测编号</span>
            <code>{examId || '未提供'}</code>
          </div>

          <section className="exam-progress" aria-labelledby="progress-title">
            <div className="exam-progress__label">
              <h2 id="progress-title">检测进度</h2>
              <strong>{displayProgress}%</strong>
            </div>
            <div
              className="exam-progress__track"
              role="progressbar"
              aria-label="检测进度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={displayProgress}
            >
              <span style={{ width: `${displayProgress}%` }} />
            </div>
          </section>

          <div className="exam-step-list">
            {EXAM_STEPS.map((step, index) => {
              const stepState = getStepState(
                step.stage,
                currentStatus?.stage ?? null,
                observerError !== null,
              )

              return (
                <article
                  className={`exam-step exam-step--${stepState}`}
                  aria-label={`${step.title}状态`}
                  key={step.stage}
                >
                  <span className="exam-step__index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                  <span
                    className="exam-step__status"
                    data-testid={step.testId}
                  >
                    {STEP_LABELS[stepState]}
                  </span>
                </article>
              )
            })}
          </div>

          {cancelError === null ? null : (
            <p className="exam-action-error" role="alert">
              {cancelError}
            </p>
          )}

          {isTerminalStage ? (
            <button
              className="exam-home-button"
              type="button"
              onClick={() => navigate('/')}
            >
              返回首页
            </button>
          ) : (
            <button
              className="exam-cancel-button"
              type="button"
              onClick={handleCancel}
              disabled={!isActiveStage || isCancelling}
              aria-busy={isCancelling}
            >
              {isCancelling ? '正在取消检测' : '取消检测'}
            </button>
          )}

          <p className="exam-demo-disclaimer">
            当前为模拟检测流程，仅用于软件原型验证，不构成医疗诊断或处方依据。
          </p>
        </aside>
      </main>
    </div>
  )
}
