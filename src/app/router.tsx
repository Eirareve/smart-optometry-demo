import { BrowserRouter, Route, Routes } from 'react-router'

import { ExamPage } from '../pages/ExamPage'
import { HomePage } from '../pages/HomePage'
import { ReportPage } from '../pages/ReportPage'
import { ResultPage } from '../pages/ResultPage'
import { AppDependenciesProvider } from './AppDependenciesProvider'
import type { AppDependencies } from './dependencies'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/exam/:examId" element={<ExamPage />} />
      <Route path="/results/:examId" element={<ResultPage />} />
      <Route path="/report/:examId" element={<ReportPage />} />
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
