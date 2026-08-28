import type { PropsWithChildren } from 'react'

import {
  AppDependenciesContext,
  appDependencies,
  type AppDependencies,
} from './dependencies'

interface AppDependenciesProviderProps extends PropsWithChildren {
  readonly dependencies?: AppDependencies
}

export function AppDependenciesProvider({
  children,
  dependencies = appDependencies,
}: AppDependenciesProviderProps) {
  return (
    <AppDependenciesContext value={dependencies}>
      {children}
    </AppDependenciesContext>
  )
}
