import type { ExtendedMetric } from '../domain'
import {
  formatMetricStatus,
  formatMetricValue,
} from '../utils/examFormatters'

interface ReportMetricTableProps {
  readonly metrics: readonly ExtendedMetric[]
}

export function ReportMetricTable({ metrics }: ReportMetricTableProps) {
  if (metrics.length === 0) {
    return (
      <p className="report-empty-metrics">
        本次 ExamResult 未提供扩展检测指标。
      </p>
    )
  }

  return (
    <>
      <div className="report-table-frame report-table-frame--metrics">
        <table className="report-metric-table" aria-label="扩展检测指标">
          <thead>
            <tr>
              <th scope="col">序号</th>
              <th scope="col">指标代码</th>
              <th scope="col">指标名称</th>
              <th scope="col">数值</th>
              <th scope="col">数据状态</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric, index) => (
              <tr key={`${metric.code}-${index}`}>
                <td>{String(index + 1).padStart(2, '0')}</td>
                <td><code>{metric.code}</code></td>
                <th scope="row">{metric.displayName}</th>
                <td>{formatMetricValue(metric)}</td>
                <td>{formatMetricStatus(metric)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ol className="report-metric-list" aria-label="扩展检测指标移动端布局">
        {metrics.map((metric, index) => (
          <li key={`${metric.code}-${index}`}>
            <div className="report-metric-list__heading">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <code>{metric.code}</code>
              <small>{formatMetricStatus(metric)}</small>
            </div>
            <strong>{metric.displayName}</strong>
            <p>{formatMetricValue(metric)}</p>
          </li>
        ))}
      </ol>
    </>
  )
}
