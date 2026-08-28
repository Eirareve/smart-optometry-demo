import type { EyeRefraction } from '../domain'

interface EyeResultCardProps {
  readonly eyeCode: 'OD' | 'OS'
  readonly eyeLabel: '右眼' | '左眼'
  readonly result: EyeRefraction
}

function formatDiopter(value: number): string {
  if (!Number.isFinite(value)) {
    return '—'
  }

  const normalizedValue = Object.is(value, -0) ? 0 : value
  const sign = normalizedValue > 0 ? '+' : normalizedValue < 0 ? '-' : ''

  return `${sign}${Math.abs(normalizedValue).toFixed(2)} D`
}

function formatAxis(value: number): string {
  if (!Number.isFinite(value)) {
    return '—'
  }

  const normalizedValue = Object.is(value, -0) ? 0 : value
  const formattedValue = new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(normalizedValue)

  return `${formattedValue}°`
}

export function EyeResultCard({
  eyeCode,
  eyeLabel,
  result,
}: EyeResultCardProps) {
  const headingId = `eye-result-${eyeCode.toLowerCase()}`

  return (
    <article
      className="eye-result-card"
      aria-labelledby={headingId}
      data-testid={`eye-result-${eyeCode.toLowerCase()}`}
    >
      <header className="eye-result-card__header">
        <div>
          <span className="eye-result-card__code">{eyeCode}</span>
          <h2 id={headingId}>{eyeLabel}</h2>
        </div>
        <span className="eye-result-card__data-label">模拟数据</span>
      </header>

      <dl className="eye-result-readings">
        <div>
          <dt>SPH</dt>
          <dd>{formatDiopter(result.sphere)}</dd>
        </div>
        <div>
          <dt>CYL</dt>
          <dd>{formatDiopter(result.cylinder)}</dd>
        </div>
        <div>
          <dt>AXIS</dt>
          <dd>{formatAxis(result.axis)}</dd>
        </div>
      </dl>
    </article>
  )
}
