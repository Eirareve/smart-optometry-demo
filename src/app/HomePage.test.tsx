import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { AppRoutes } from './router'

describe('smart optometry home page', () => {
  it('shows the Demo device state without claiming a connection', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: '智能验光系统' }),
    ).toBeInTheDocument()
    expect(screen.getByText('DEMO MODE')).toBeInTheDocument()
    expect(screen.getByText(/OPT-DEMO-001/)).toBeInTheDocument()
    expect(screen.getByText('设备未接入')).toBeInTheDocument()
    expect(screen.getByText('暂无通信')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /开始智能验光/ }),
    ).toBeDisabled()
    expect(screen.queryByText('已连接')).not.toBeInTheDocument()
  })

  it('explains that connection is unavailable without simulating it', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '连接设备' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      '当前阶段尚未接入设备，连接功能暂不可用。',
    )
    expect(screen.queryByText('已连接')).not.toBeInTheDocument()
  })
})
