import type { ExtendedMetric } from '../domain'

interface MetricGridProps {
  readonly metrics: readonly ExtendedMetric[]
}

function formatMetricValue(metric: ExtendedMetric): string {
  const value = String(metric.value)

  return metric.unit === undefined || metric.unit.trim() === ''
    ? value
    : `${value} ${metric.unit}`
}

function getMetricStatusLabel(metric: ExtendedMetric): string {
  return metric.status === undefined || metric.status === 'unknown'
    ? '待定义'
    : '状态待确认'
}

export function MetricGrid({ metrics }: MetricGridProps) {
  return (
    <section className="metric-section" aria-labelledby="metric-section-title">
      <div className="metric-section__heading">
        <div>
          <p className="section-kicker">EXTENDED METRICS</p>
          <h2 id="metric-section-title">扩展检测指标</h2>
        </div>
        <span>{metrics.length} 项 · 数据定义待厂家资料确认</span>
      </div>

      <ol className="metric-grid">
        {metrics.map((metric, index) => (
          <li className="metric-card" key={`${metric.code}-${index}`}>
            <div className="metric-card__heading">
              <code>{metric.code}</code>
              <span>{String(index + 1).padStart(2, '0')}</span>
            </div>
            <h3>{metric.displayName}</h3>
            <div className="metric-card__value-row">
              <strong>{formatMetricValue(metric)}</strong>
              <span className="metric-card__status">
                {getMetricStatusLabel(metric)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
