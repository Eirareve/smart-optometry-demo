import { BrowserRouter, Route, Routes } from 'react-router'

import { HomePage } from '../pages/HomePage'
import { AppDependenciesProvider } from './AppDependenciesProvider'
import type { AppDependencies } from './dependencies'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  )
}

interface AppRouterProps {
  readonly dependencies?: AppDependencies
}

export function AppRouter({ dependencies }: AppRouterProps) {
  return (
    <AppDependenciesProvider dependencies={dependencies}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppDependenciesProvider>
  )
}
