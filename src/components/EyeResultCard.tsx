import type { EyeRefraction } from '../domain'
import { formatAxis, formatDiopter } from '../utils/examFormatters'

interface EyeResultCardProps {
  readonly eyeCode: 'OD' | 'OS'
  readonly eyeLabel: '右眼' | '左眼'
  readonly result: EyeRefraction
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
