import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { useAppDependencies } from '../app/dependencies'
import { DeviceStatusCard } from '../components/DeviceStatusCard'
import type {
  DeviceConnectionState,
  DeviceInfo,
  DeviceOperatingState,
  DeviceStatus,
} from '../domain'

const CONNECTION_STATUS_LABELS: Readonly<
  Record<DeviceConnectionState, string>
> = {
  disconnected: '设备未连接',
  connecting: '正在连接',
  connected: '已连接',
  disconnecting: '正在断开',
  error: '连接异常',
}

function formatLastCommunication(isoTimestamp: string | null): string {
  if (isoTimestamp === null) {
    return '暂无通信'
  }

  const communicationTime = new Date(isoTimestamp)

  if (Number.isNaN(communicationTime.getTime())) {
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
  }).format(communicationTime)
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message
  }

  return '发生未知错误，请重试。'
}

function BrandMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" fill="none">
      <path d="M5 24s7-11 19-11 19 11 19 11-7 11-19 11S5 24 5 24Z" />
      <circle cx="24" cy="24" r="6" />
      <path d="M24 5v4M24 39v4M5 14l4 2M39 32l4 2" />
    </svg>
  )
}

export function HomePage() {
  const { examService } = useAppDependencies()
  const navigate = useNavigate()
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [connectionState, setConnectionState] =
    useState<DeviceConnectionState>('disconnected')
  const [lastCommunicationAt, setLastCommunicationAt] = useState<
    string | null
  >(null)
  const [operatingState, setOperatingState] =
    useState<DeviceOperatingState>('unknown')
  const [connectionNotice, setConnectionNotice] = useState('')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [examStartError, setExamStartError] = useState<string | null>(null)
  const [isStartingExam, setIsStartingExam] = useState(false)
  const requestVersionRef = useRef(0)

  useEffect(() => {
    let isActive = true
    const requestVersion = ++requestVersionRef.current

    const loadDeviceState = async () => {
      try {
        let status = await examService.getDeviceStatus()
        let info: DeviceInfo | null = null

        if (status.connectionState === 'connected') {
          info = await examService.connect()
          status = await examService.getDeviceStatus()
        }

        if (!isActive || requestVersionRef.current !== requestVersion) {
          return
        }

        setDeviceInfo(info)
        setConnectionState(status.connectionState)
        setOperatingState(status.operatingState)
        setLastCommunicationAt(status.lastCommunicationAt)
        setConnectionNotice(status.message ?? '')
        setConnectionError(null)
      } catch (error) {
        if (!isActive || requestVersionRef.current !== requestVersion) {
          return
        }

        setConnectionState('error')
        setOperatingState('error')
        setConnectionError(
          `读取模拟设备状态失败：${getErrorMessage(error)}`,
        )
      }
    }

    void loadDeviceState()

    return () => {
      isActive = false
      requestVersionRef.current += 1
    }
  }, [examService])

  const handleConnect = async () => {
    if (
      connectionState === 'connecting' ||
      connectionState === 'connected'
    ) {
      return
    }

    const requestVersion = ++requestVersionRef.current

    setConnectionState('connecting')
    setOperatingState('unknown')
    setConnectionNotice('正在连接 Mock Device（模拟设备）…')
    setConnectionError(null)

    try {
      const info = await examService.connect()
      const status = await examService.getDeviceStatus()

      if (requestVersionRef.current !== requestVersion) {
        return
      }

      setDeviceInfo(info)
      setConnectionState(status.connectionState)
      setOperatingState(status.operatingState)
      setLastCommunicationAt(status.lastCommunicationAt)
      setConnectionNotice(status.message ?? 'Mock/Demo 设备已连接。')
    } catch (error) {
      if (requestVersionRef.current !== requestVersion) {
        return
      }

      let latestStatus: DeviceStatus | null = null

      try {
        latestStatus = await examService.getDeviceStatus()
      } catch {
        // 连接错误仍由下方可见提示呈现；状态读取失败时使用 error 回退状态。
      }

      if (requestVersionRef.current !== requestVersion) {
        return
      }

      setConnectionState(latestStatus?.connectionState ?? 'error')
      setOperatingState(latestStatus?.operatingState ?? 'error')
      setLastCommunicationAt(latestStatus?.lastCommunicationAt ?? null)
      setConnectionNotice(latestStatus?.message ?? '')
      setConnectionError(`模拟设备连接失败：${getErrorMessage(error)}`)
    }
  }

  const isDeviceReady =
    connectionState === 'connected' && operatingState === 'idle'

  const handleStartExam = async () => {
    if (!isDeviceReady || isStartingExam) {
      return
    }

    const requestVersion = ++requestVersionRef.current

    setIsStartingExam(true)
    setExamStartError(null)

    try {
      const session = await examService.startExam()

      if (requestVersionRef.current !== requestVersion) {
        return
      }

      navigate(`/exam/${encodeURIComponent(session.examId)}`)
    } catch (error) {
      if (requestVersionRef.current !== requestVersion) {
        return
      }

      setExamStartError(`启动模拟检测失败：${getErrorMessage(error)}`)
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setIsStartingExam(false)
      }
    }
  }

  const examAvailabilityMessage = isStartingExam
    ? '正在创建模拟检测会话…'
    : isDeviceReady
      ? '模拟设备已就绪，可开始检测'
      : connectionState === 'connected' && operatingState === 'busy'
        ? '模拟设备正在执行检测'
    : connectionState === 'connecting'
      ? '正在建立模拟连接，请稍候'
      : '设备连接后可开始检测'

  return (
    <div className="home-shell">
      <div className="ambient-glow ambient-glow--top" aria-hidden="true" />
      <div className="ambient-glow ambient-glow--bottom" aria-hidden="true" />

      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">
            <BrandMark />
          </span>
          <div>
            <p className="brand__english">SMART OPTOMETRY</p>
            <h1>智能验光系统</h1>
          </div>
        </div>

        <span className="demo-mode">
          <span className="demo-mode__pulse" aria-hidden="true" />
          DEMO MODE
        </span>
      </header>

      <main className="home-main">
        <section className="hero" aria-labelledby="hero-title">
          <p className="hero__eyebrow">INTELLIGENT VISION EXAMINATION</p>
          <h2 id="hero-title">
            让验光流程
            <span>更清晰，更从容。</span>
          </h2>
          <p className="hero__description">
            面向智能验光设备的软件演示平台，清晰呈现设备状态与操作入口。
          </p>

          <div className="primary-action">
            <button
              className="primary-button"
              type="button"
              disabled={!isDeviceReady || isStartingExam}
              onClick={handleStartExam}
              aria-busy={isStartingExam}
              aria-describedby="exam-disabled-reason"
            >
              <span>{isStartingExam ? '正在启动检测' : '开始智能验光'}</span>
              <span className="button-arrow" aria-hidden="true">
                →
              </span>
            </button>
            <p id="exam-disabled-reason">{examAvailabilityMessage}</p>
            {examStartError === null ? null : (
              <p className="exam-start-error" role="alert">
                {examStartError}
              </p>
            )}
          </div>
        </section>

        <DeviceStatusCard
          deviceId={deviceInfo?.id ?? '连接后读取'}
          deviceName={deviceInfo?.name ?? 'Mock Device（模拟设备）'}
          connectionState={connectionState}
          connectionStatus={CONNECTION_STATUS_LABELS[connectionState]}
          lastCommunication={formatLastCommunication(lastCommunicationAt)}
          connectionNotice={connectionNotice}
          connectionError={connectionError}
          onConnect={handleConnect}
        />
      </main>

      <footer className="home-footer">
        <span className="prototype-state">
          <span aria-hidden="true" />
          当前未接入真实设备
        </span>
        <span>SOFTWARE PROTOTYPE · V0.1</span>
      </footer>
    </div>
  )
}
