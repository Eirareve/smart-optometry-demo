import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useAppDependencies } from '../app/dependencies'
import { EyeResultCard } from '../components/EyeResultCard'
import { MetricGrid } from '../components/MetricGrid'
import type { ExamResult } from '../domain'
import { DeviceAdapterError } from '../services/device'

interface ResultEntry {
  readonly examId: string
  readonly result: ExamResult
}

interface ResultFailure {
  readonly examId: string
  readonly title: string
  readonly message: string
  readonly kind: 'missing' | 'incomplete' | 'unknown'
}

function describeResultError(examId: string, error: unknown): ResultFailure {
  if (error instanceof DeviceAdapterError) {
    if (error.code === 'EXAM_NOT_FOUND') {
      return {
        examId,
        title: '无法读取本次检测结果',
        message:
          '当前模拟检测记录已不存在，请返回首页重新检测。页面刷新后，Mock Device 的内存会话可能已经清空。',
        kind: 'missing',
      }
    }

    if (error.code === 'EXAM_NOT_COMPLETED') {
      return {
        examId,
        title: '检测尚未完成',
        message:
          '本次检测尚未完成，暂时无法读取验光结果。请返回检测页面等待完成，不能提前生成模拟结果。',
        kind: 'incomplete',
      }
    }
  }

  const detail =
    error instanceof Error && error.message.trim() !== ''
      ? `：${error.message}`
      : ''

  return {
    examId,
    title: '无法读取本次检测结果',
    message: `读取标准验光结果时发生错误${detail}。请返回首页重新检测。`,
    kind: 'unknown',
  }
}

function formatResultTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)

  if (Number.isNaN(date.getTime())) {
    return isoTimestamp
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function getSourceLabel(source: ExamResult['source']): string {
  return source === 'mock' ? 'Mock Device' : '标准设备数据'
}

export function ResultPage() {
  const { examId: routeExamId } = useParams<'examId'>()
  const examId = routeExamId?.trim() ?? ''
  const { examService } = useAppDependencies()
  const navigate = useNavigate()
  const [resultEntry, setResultEntry] = useState<ResultEntry | null>(null)
  const [failure, setFailure] = useState<ResultFailure | null>(null)
  const requestVersionRef = useRef(0)

  useEffect(() => {
    const requestVersion = ++requestVersionRef.current

    if (examId === '') {
      return () => {
        requestVersionRef.current += 1
      }
    }

    void examService.getExamResult(examId).then(
      (result) => {
        if (requestVersionRef.current !== requestVersion) {
          return
        }

        setResultEntry({ examId, result })
        setFailure(null)
      },
      (error: unknown) => {
        if (requestVersionRef.current !== requestVersion) {
          return
        }

        setResultEntry(null)
        setFailure(describeResultError(examId, error))
      },
    )

    return () => {
      requestVersionRef.current += 1
    }
  }, [examId, examService])

  const currentResult =
    resultEntry?.examId === examId ? resultEntry.result : null
  const currentFailure = failure?.examId === examId ? failure : null
  const missingExamId = examId === ''
  const isLoading =
    !missingExamId && currentResult === null && currentFailure === null

  return (
    <div className="result-shell">
      <div className="ambient-glow ambient-glow--top" aria-hidden="true" />
      <div className="ambient-glow ambient-glow--bottom" aria-hidden="true" />

      <header className="result-topbar">
        <div>
          <p className="brand__english">SMART OPTOMETRY</p>
          <h1>智能验光结果</h1>
        </div>
        <div className="result-topbar__badges">
          <span className="demo-mode">
            <span className="demo-mode__pulse" aria-hidden="true" />
            DEMO MODE
          </span>
          <span className="result-data-badge">模拟数据</span>
        </div>
      </header>

      <main className="result-main">
        {isLoading ? (
          <section className="result-state-card" role="status" aria-live="polite">
            <span className="result-loading-indicator" aria-hidden="true" />
            <p className="section-kicker">LOADING RESULT</p>
            <h2>正在读取验光结果</h2>
            <p>正在通过验光流程服务读取标准 ExamResult，请稍候…</p>
            <code>{examId}</code>
          </section>
        ) : null}

        {missingExamId || currentFailure !== null ? (
          <section className="result-state-card result-state-card--error" role="alert">
            <p className="section-kicker">RESULT UNAVAILABLE</p>
            <h2>
              {missingExamId
                ? '无法读取本次检测结果'
                : currentFailure?.title}
            </h2>
            <p>
              {missingExamId
                ? '检测编号缺失，请返回首页重新检测。'
                : currentFailure?.message}
            </p>
            <code>{examId || '未提供 examId'}</code>
            <div className="result-state-actions">
              {currentFailure?.kind === 'incomplete' ? (
                <button
                  className="result-secondary-button"
                  type="button"
                  onClick={() =>
                    navigate(`/exam/${encodeURIComponent(examId)}`)
                  }
                >
                  返回检测页面
                </button>
              ) : null}
              <button
                className="result-primary-button"
                type="button"
                onClick={() => navigate('/')}
              >
                返回首页重新检测
              </button>
            </div>
          </section>
        ) : null}

        {currentResult === null ? null : (
          <>
            <section className="result-summary" aria-labelledby="result-summary-title">
              <div className="result-summary__heading">
                <div>
                  <p className="section-kicker">EXAM COMPLETED</p>
                  <h2 id="result-summary-title">本次模拟检测已完成</h2>
                </div>
                <span>标准化结果</span>
              </div>

              <dl className="result-metadata">
                <div className="result-metadata__exam-id">
                  <dt>examId</dt>
                  <dd><code>{currentResult.examId}</code></dd>
                </div>
                <div>
                  <dt>检测开始时间</dt>
                  <dd>{formatResultTime(currentResult.startedAt)}</dd>
                </div>
                <div>
                  <dt>检测完成时间</dt>
                  <dd>{formatResultTime(currentResult.completedAt)}</dd>
                </div>
                <div>
                  <dt>数据来源</dt>
                  <dd>{getSourceLabel(currentResult.source)}</dd>
                </div>
              </dl>
            </section>

            <section className="eye-results" aria-label="左右眼核心屈光数据">
              <EyeResultCard
                eyeCode="OD"
                eyeLabel="右眼"
                result={currentResult.rightEye}
              />
              <EyeResultCard
                eyeCode="OS"
                eyeLabel="左眼"
                result={currentResult.leftEye}
              />
            </section>

            <MetricGrid metrics={currentResult.metrics} />

            <section className="result-disclaimer" aria-label="模拟数据声明">
              <span aria-hidden="true">!</span>
              <p>
                当前结果使用模拟设备数据，仅用于软件原型与交互流程验证，不构成医疗诊断、验光处方或治疗建议。
              </p>
            </section>

            <div className="result-actions" aria-label="结果页操作">
              <button
                className="result-primary-button"
                type="button"
                onClick={() => navigate('/')}
              >
                重新检测
              </button>
              <button
                className="result-secondary-button"
                type="button"
                onClick={() => navigate('/')}
              >
                返回首页
              </button>
              <button
                className="result-disabled-button"
                type="button"
                disabled
              >
                生成报告（下一阶段）
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
