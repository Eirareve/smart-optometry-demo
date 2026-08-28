import type { DeviceConnectionState } from '../domain'

type DeviceStatusCardProps = {
  deviceId: string
  deviceName: string
  connectionState: DeviceConnectionState
  connectionStatus: string
  lastCommunication: string
  connectionNotice: string
  connectionError: string | null
  onConnect: () => void
}

const STATUS_CHIP_LABELS: Readonly<Record<DeviceConnectionState, string>> = {
  disconnected: '未连接',
  connecting: '连接中',
  connected: '已连接',
  disconnecting: '断开中',
  error: '连接异常',
}

function DeviceIcon() {
  return (
    <svg
      aria-hidden="true"
      className="device-icon"
      viewBox="0 0 48 48"
      fill="none"
    >
      <rect x="8" y="5" width="32" height="38" rx="10" />
      <circle cx="24" cy="19" r="7" />
      <path d="M17 34h14M20 30h8" />
    </svg>
  )
}

export function DeviceStatusCard({
  deviceId,
  deviceName,
  connectionState,
  connectionStatus,
  lastCommunication,
  connectionNotice,
  connectionError,
  onConnect,
}: DeviceStatusCardProps) {
  const isConnectDisabled =
    connectionState === 'connecting' || connectionState === 'connected'

  return (
    <section className="device-card" aria-labelledby="device-card-title">
      <div className="device-card__header">
        <div>
          <p className="section-kicker">DEVICE OVERVIEW</p>
          <h2 id="device-card-title">设备状态</h2>
        </div>
        <span className={`status-chip status-chip--${connectionState}`}>
          <span className="status-chip__dot" aria-hidden="true" />
          {STATUS_CHIP_LABELS[connectionState]}
        </span>
      </div>

      <div className="device-identity">
        <div className="device-identity__icon">
          <DeviceIcon />
        </div>
        <div>
          <p className="device-identity__name">{deviceName}</p>
          <p className="device-identity__id">编号 {deviceId}</p>
        </div>
      </div>

      <dl className="device-details">
        <div className="device-detail">
          <dt>连接状态</dt>
          <dd>{connectionStatus}</dd>
        </div>
        <div className="device-detail">
          <dt>最后通信时间</dt>
          <dd>{lastCommunication}</dd>
        </div>
      </dl>

      <button
        className="secondary-button"
        type="button"
        onClick={onConnect}
        disabled={isConnectDisabled}
        aria-busy={connectionState === 'connecting'}
      >
        <span className="button-plug" aria-hidden="true" />
        {connectionState === 'connecting'
          ? '正在连接'
          : connectionState === 'connected'
            ? '模拟设备已连接'
            : '连接设备'}
      </button>

      <p className="connection-notice" role="status" aria-live="polite">
        {connectionNotice}
      </p>
      {connectionError === null ? null : (
        <p className="connection-error" role="alert">
          {connectionError}
        </p>
      )}
    </section>
  )
}
