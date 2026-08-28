/** Mock Device 可重复选择的 Demo 故障场景。 */
export type MockDeviceScenario =
  | 'normal'
  | 'connect_failure'
  | 'start_exam_failure'
  | 'exam_error'
  | 'status_query_failure'

/**
 * 仅供 Demo / Developer 工具控制 Mock 行为。
 * 该接口不属于 DeviceAdapter，未来 RealDeviceAdapter 无需实现。
 */
export interface MockDeviceControl {
  getScenario(): MockDeviceScenario
  setScenario(scenario: MockDeviceScenario): void
  reset(): void
}
