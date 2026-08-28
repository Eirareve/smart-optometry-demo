import type { EyeRefraction } from '../domain'
import { formatAxis, formatDiopter } from '../utils/examFormatters'

interface ReportEyeTableProps {
  readonly rightEye: EyeRefraction
  readonly leftEye: EyeRefraction
}

export function ReportEyeTable({
  rightEye,
  leftEye,
}: ReportEyeTableProps) {
  const eyeResults = [
    { code: 'OD', label: '右眼', result: rightEye },
    { code: 'OS', label: '左眼', result: leftEye },
  ] as const

  return (
    <>
      <div className="report-table-frame report-eye-table-frame">
        <table className="report-eye-table" aria-label="左右眼核心屈光结果">
          <thead>
            <tr>
              <th scope="col">检测项目</th>
              <th scope="col">
                <strong>右眼 OD</strong>
                <span>模拟数据</span>
              </th>
              <th scope="col">
                <strong>左眼 OS</strong>
                <span>模拟数据</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">SPH</th>
              <td>{formatDiopter(rightEye.sphere)}</td>
              <td>{formatDiopter(leftEye.sphere)}</td>
            </tr>
            <tr>
              <th scope="row">CYL</th>
              <td>{formatDiopter(rightEye.cylinder)}</td>
              <td>{formatDiopter(leftEye.cylinder)}</td>
            </tr>
            <tr>
              <th scope="row">AXIS</th>
              <td>{formatAxis(rightEye.axis)}</td>
              <td>{formatAxis(leftEye.axis)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="report-eye-cards" aria-label="左右眼核心屈光结果">
        {eyeResults.map(({ code, label, result }) => (
          <article className="report-eye-card" key={code}>
            <header>
              <div>
                <strong>{code}</strong>
                <span>{label}</span>
              </div>
              <small>模拟数据</small>
            </header>
            <dl>
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
        ))}
      </div>
    </>
  )
}
