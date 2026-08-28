import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useAppDependencies } from '../app/dependencies'
import { ReportEyeTable } from '../components/ReportEyeTable'
import { ReportMetricTable } from '../components/ReportMetricTable'
import type { ExamResult } from '../domain'
import { DeviceAdapterError } from '../services/device'
import {
  formatExamSource,
  formatExamTime,
} from '../utils/examFormatters'

interface ReportEntry {
  readonly examId: string
  readonly result: ExamResult
}

interface ReportFailure {
  readonly examId: string
  readonly title: string
  readonly message: string
  readonly kind: 'missing' | 'incomplete' | 'unknown'
}

function describeReportError(examId: string, error: unknown): ReportFailure {
  if (error instanceof DeviceAdapterError) {
    if (error.code === 'EXAM_NOT_FOUND') {
      return {
        examId,
        title: '无法生成本次验光报告',
        message: '当前模拟检测记录已不存在，请返回首页重新检测。',
        kind: 'missing',
      }
    }

    if (error.code === 'EXAM_NOT_COMPLETED') {
      return {
        examId,
        title: '本次检测尚未完成，无法生成报告。',
        message: '请返回检测页面等待本次模拟检测完成。',
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
    title: '无法生成本次验光报告',
    message: `读取标准验光结果时发生错误${detail}。请返回首页重新检测。`,
    kind: 'unknown',
  }
}

function createDemoReportNumber(examId: string): string {
  return `DEMO-RPT-${examId}`
}

export function ReportPage() {
  const { examId: routeExamId } = useParams<'examId'>()
  const examId = routeExamId?.trim() ?? ''
  const { examService } = useAppDependencies()
  const navigate = useNavigate()
  const [reportEntry, setReportEntry] = useState<ReportEntry | null>(null)
  const [failure, setFailure] = useState<ReportFailure | null>(null)
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

        setReportEntry({ examId, result })
        setFailure(null)
      },
      (error: unknown) => {
        if (requestVersionRef.current !== requestVersion) {
          return
        }

        setReportEntry(null)
        setFailure(describeReportError(examId, error))
      },
    )

    return () => {
      requestVersionRef.current += 1
    }
  }, [examId, examService])

  const currentResult =
    reportEntry?.examId === examId ? reportEntry.result : null
  const currentFailure = failure?.examId === examId ? failure : null
  const missingExamId = examId === ''
  const isLoading =
    !missingExamId && currentResult === null && currentFailure === null

  return (
    <div className="report-shell">
      <div className="ambient-glow ambient-glow--top" aria-hidden="true" />
      <div className="ambient-glow ambient-glow--bottom" aria-hidden="true" />

      <header className="report-topbar">
        <div>
          <p className="brand__english">SMART OPTOMETRY</p>
          <h1>智能验光报告</h1>
        </div>
        <div className="report-topbar__badges">
          <span className="demo-mode">
            <span className="demo-mode__pulse" aria-hidden="true" />
            DEMO MODE
          </span>
          <span className="result-data-badge">模拟数据</span>
        </div>
      </header>

      <main className="report-main">
        {isLoading ? (
          <section className="report-state-card" role="status" aria-live="polite">
            <span className="result-loading-indicator" aria-hidden="true" />
            <p className="section-kicker">LOADING REPORT</p>
            <h2>正在生成电子验光报告</h2>
            <p>正在通过验光流程服务读取标准 ExamResult，请稍候…</p>
            <code>{examId}</code>
          </section>
        ) : null}

        {missingExamId || currentFailure !== null ? (
          <section className="report-state-card report-state-card--error" role="alert">
            <p className="section-kicker">REPORT UNAVAILABLE</p>
            <h2>
              {missingExamId
                ? '无法生成本次验光报告'
                : currentFailure?.title}
            </h2>
            <p>
              {missingExamId
                ? '检测编号缺失，请返回首页重新检测。'
                : currentFailure?.message}
            </p>
            <code>{examId || '未提供 examId'}</code>
            <div className="report-state-actions">
              {currentFailure?.kind === 'incomplete' ? (
                <button
                  className="report-secondary-button"
                  type="button"
                  onClick={() =>
                    navigate(`/exam/${encodeURIComponent(examId)}`)
                  }
                >
                  返回检测页面
                </button>
              ) : null}
              <button
                className="report-primary-button"
                type="button"
                onClick={() => navigate('/')}
              >
                返回首页
              </button>
            </div>
          </section>
        ) : null}

        {currentResult === null ? null : (
          <>
            <article className="report-document" aria-labelledby="report-title">
              <section className="report-identity">
                <div>
                  <p className="section-kicker">ELECTRONIC OPTOMETRY REPORT</p>
                  <h2 id="report-title">智能验光报告</h2>
                  <p>
                    本报告为网页 Demo 生成的电子展示报告，报告编号仅由 examId
                    生成用于本次原型展示。
                  </p>
                </div>
                <div className="report-stamp" aria-label="报告状态">
                  <strong>DEMO MODE</strong>
                  <span>模拟数据</span>
                </div>
              </section>

              <section className="report-section" aria-labelledby="report-info-title">
                <div className="report-section__heading">
                  <div>
                    <span>01</span>
                    <h3 id="report-info-title">基础信息</h3>
                  </div>
                  <p>标准 ExamResult</p>
                </div>
                <dl className="report-metadata">
                  <div>
                    <dt>报告编号（Demo 展示）</dt>
                    <dd><code>{createDemoReportNumber(currentResult.examId)}</code></dd>
                  </div>
                  <div>
                    <dt>examId</dt>
                    <dd><code>{currentResult.examId}</code></dd>
                  </div>
                  <div>
                    <dt>检测开始时间</dt>
                    <dd>{formatExamTime(currentResult.startedAt)}</dd>
                  </div>
                  <div>
                    <dt>检测完成时间</dt>
                    <dd>{formatExamTime(currentResult.completedAt)}</dd>
                  </div>
                  <div>
                    <dt>数据来源</dt>
                    <dd>{formatExamSource(currentResult.source)}</dd>
                  </div>
                  <div>
                    <dt>报告状态</dt>
                    <dd>DEMO MODE · 模拟数据</dd>
                  </div>
                </dl>
              </section>

              <section className="report-section" aria-labelledby="report-eye-title">
                <div className="report-section__heading">
                  <div>
                    <span>02</span>
                    <h3 id="report-eye-title">核心屈光结果</h3>
                  </div>
                  <p>OD / OS · SPH / CYL / AXIS</p>
                </div>
                <ReportEyeTable
                  rightEye={currentResult.rightEye}
                  leftEye={currentResult.leftEye}
                />
              </section>

              <section className="report-section" aria-labelledby="report-metric-title">
                <div className="report-section__heading">
                  <div>
                    <span>03</span>
                    <h3 id="report-metric-title">扩展检测指标</h3>
                  </div>
                  <p>{currentResult.metrics.length} 项 · 定义待厂家资料确认</p>
                </div>
                <ReportMetricTable metrics={currentResult.metrics} />
              </section>

              <section className="report-section report-summary-section" aria-labelledby="report-summary-title">
                <div className="report-section__heading">
                  <div>
                    <span>04</span>
                    <h3 id="report-summary-title">检测摘要</h3>
                  </div>
                </div>
                <p>
                  本次模拟检测已采集左右眼核心屈光数据及扩展检测指标。
                </p>
              </section>

              <section className="report-disclaimer" aria-label="模拟数据声明">
                <strong>DEMO / 模拟数据声明</strong>
                <p>
                  本报告当前使用模拟设备数据，仅用于智能验光软件原型、交互流程及设备接入架构验证，不构成医疗诊断、验光处方、疾病筛查或治疗建议。
                </p>
              </section>
            </article>

            <div className="report-actions report-screen-only" aria-label="报告页操作">
              <button
                className="report-primary-button"
                type="button"
                onClick={() => window.print()}
              >
                打印报告
              </button>
              <button
                className="report-secondary-button"
                type="button"
                onClick={() =>
                  navigate(
                    `/results/${encodeURIComponent(currentResult.examId)}`,
                  )
                }
              >
                返回验光结果
              </button>
              <button
                className="report-secondary-button"
                type="button"
                onClick={() => navigate('/')}
              >
                返回首页
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
