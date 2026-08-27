import { useState } from 'react'

import { DeviceStatusCard } from '../components/DeviceStatusCard'

const demoDevice = {
  deviceId: 'OPT-DEMO-001',
  deviceName: '智能验光设备',
  connectionStatus: '设备未接入',
  lastCommunication: '暂无通信',
} as const

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
  const [connectionNotice, setConnectionNotice] = useState('')

  const handleConnect = () => {
    setConnectionNotice('当前阶段尚未接入设备，连接功能暂不可用。')
  }

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
              disabled
              aria-describedby="exam-disabled-reason"
            >
              <span>开始智能验光</span>
              <span className="button-arrow" aria-hidden="true">
                →
              </span>
            </button>
            <p id="exam-disabled-reason">设备连接后可开始检测</p>
          </div>
        </section>

        <DeviceStatusCard
          {...demoDevice}
          connectionNotice={connectionNotice}
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
