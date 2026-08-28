import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { FAST_MOCK_DEVICE_TIMING, MockDeviceAdapter } from '../services/device'
import { ExamService } from '../services/exam'
import { AppDependenciesProvider } from './AppDependenciesProvider'
import { AppRoutes } from './router'

function createTestDependencies(connectDelayMs = 0) {
  const adapter = new MockDeviceAdapter({
    timing: {
      ...FAST_MOCK_DEVICE_TIMING,
      connectDelayMs,
    },
  })
  const examService = new ExamService(adapter)

  return {
    adapter,
    dependencies: { examService },
    examService,
  }
}

function renderHome(dependencies = createTestDependencies().dependencies) {
  return render(
    <AppDependenciesProvider dependencies={dependencies}>
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    </AppDependenciesProvider>,
  )
}

describe('smart optometry home page', () => {
  it('shows the disconnected Mock device state initially', async () => {
    renderHome()

    expect(
      screen.getByRole('heading', { name: '智能验光系统' }),
    ).toBeInTheDocument()
    expect(screen.getByText('DEMO MODE')).toBeInTheDocument()
    expect(screen.getByText('Mock Device（模拟设备）')).toBeInTheDocument()
    expect(screen.getByText('设备未连接')).toBeInTheDocument()
    expect(screen.getByText('暂无通信')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /开始智能验光/ }),
    ).toBeDisabled()
    expect(screen.queryByText('已连接')).not.toBeInTheDocument()

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Mock/Demo 设备已断开',
    )
  })

  it('connects through ExamService and enables the exam action', async () => {
    const { adapter, dependencies } = createTestDependencies(20)
    const connect = vi.spyOn(adapter, 'connect')

    renderHome(dependencies)

    fireEvent.click(screen.getByRole('button', { name: '连接设备' }))

    expect(screen.getAllByText('正在连接')).not.toHaveLength(0)
    expect(
      screen.getByRole('button', { name: /开始智能验光/ }),
    ).toBeDisabled()

    expect(
      await screen.findByText('Smart Optometry Mock Device'),
    ).toBeInTheDocument()
    expect(screen.getByText(/MOCK-OPT-001/)).toBeInTheDocument()
    expect(screen.getAllByText('已连接')).not.toHaveLength(0)
    expect(screen.queryByText('暂无通信')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /开始智能验光/ }),
    ).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Mock/Demo 设备已连接并就绪',
    )
    expect(connect).toHaveBeenCalledTimes(1)
  })

  it('shows a visible error and allows retry when connecting fails', async () => {
    const { dependencies, examService } = createTestDependencies()

    vi.spyOn(examService, 'connect').mockRejectedValueOnce(
      new Error('模拟连接失败'),
    )
    renderHome(dependencies)

    fireEvent.click(screen.getByRole('button', { name: '连接设备' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '模拟设备连接失败：模拟连接失败',
    )
    expect(screen.getByRole('button', { name: '连接设备' })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: /开始智能验光/ }),
    ).toBeDisabled()
  })

  it('keeps the connected Mock device state when the page remounts', async () => {
    const { dependencies } = createTestDependencies()
    const firstRender = renderHome(dependencies)

    fireEvent.click(screen.getByRole('button', { name: '连接设备' }))
    expect(
      await screen.findByText('Smart Optometry Mock Device'),
    ).toBeInTheDocument()

    firstRender.unmount()
    renderHome(dependencies)

    expect(
      await screen.findByText('Smart Optometry Mock Device'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('已连接')).not.toHaveLength(0)
    expect(
      screen.getByRole('button', { name: /开始智能验光/ }),
    ).toBeEnabled()
  })

  it('starts an exam through ExamService and navigates to ExamPage', async () => {
    const { dependencies, examService } = createTestDependencies()
    const startExam = vi.spyOn(examService, 'startExam')

    renderHome(dependencies)

    fireEvent.click(screen.getByRole('button', { name: '连接设备' }))
    expect(
      await screen.findByText('Smart Optometry Mock Device'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /开始智能验光/ }),
    )

    expect(await screen.findByText('检测编号')).toBeInTheDocument()
    expect(screen.getByText(/^MOCK-EXAM-/)).toBeInTheDocument()
    expect(screen.getByText('DEMO MODE')).toBeInTheDocument()
    expect(startExam).toHaveBeenCalledTimes(1)
  })

  it('shows a visible error when starting an exam fails', async () => {
    const { dependencies, examService } = createTestDependencies()

    vi.spyOn(examService, 'startExam').mockRejectedValueOnce(
      new Error('模拟设备忙碌'),
    )
    renderHome(dependencies)

    fireEvent.click(screen.getByRole('button', { name: '连接设备' }))
    expect(
      await screen.findByText('Smart Optometry Mock Device'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /开始智能验光/ }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '启动模拟检测失败：模拟设备忙碌',
    )
    expect(
      screen.getByRole('button', { name: /开始智能验光/ }),
    ).toBeEnabled()
  })
})
