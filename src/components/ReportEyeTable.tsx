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
  return (
    <div className="report-table-frame">
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
  )
}
