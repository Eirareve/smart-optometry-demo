import { createContext, useContext } from 'react'

import type { DeviceAdapter } from '../services/device'
import { MockDeviceAdapter } from '../services/device'
import { ExamService } from '../services/exam'

export interface AppDependencies {
  readonly examService: ExamService
}

const deviceAdapter: DeviceAdapter = new MockDeviceAdapter()

/**
 * 应用级依赖只在本模块首次加载时创建一次。页面切换不会重新执行该装配过程。
 */
export const appDependencies: AppDependencies = Object.freeze({
  examService: new ExamService(deviceAdapter),
})

export const AppDependenciesContext = createContext<AppDependencies | null>(
  null,
)

export function useAppDependencies(): AppDependencies {
  const dependencies = useContext(AppDependenciesContext)

  if (dependencies === null) {
    throw new Error('AppDependenciesProvider is missing')
  }

  return dependencies
}
