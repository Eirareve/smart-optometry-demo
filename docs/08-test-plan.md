# 测试计划

## Phase 1 首页

- 显示“智能验光系统”标题。
- 显示 DEMO MODE。
- 显示设备编号 `OPT-DEMO-001`。
- 显示“设备未接入”和“暂无通信”。
- “开始智能验光”按钮保持不可用，不启动检测。
- 点击“连接设备”只显示不可用提示，不显示“已连接”。

## ExamService 验光流程编排层

- 使用现有 `MockDeviceAdapter`、`FAST_MOCK_DEVICE_TIMING`、Vitest fake timers 和方法 spy，不创建第二套设备 Mock。
- 正常状态按 `preparing → left_eye → right_eye → analyzing → completed` 发布。
- `completed` 发布后 `getExamStatus()` 调用次数不再增加。
- 主动取消后发布 Adapter 的 `cancelled` 快照，且不再轮询。
- Mock 检测进入 `error` 后发布该终态，且不再轮询。
- `getExamStatus()` Promise 拒绝时调用观察者 `onError`，不生成结果，并停止轮询。
- cleanup 可重复调用；最后一个订阅 cleanup 后没有新查询或回调，在途旧响应不能重新启动定时器。
- 同一 `examId` 的多个观察者共享一条轮询链；移除一个观察者不影响其他观察者，移除最后一个后停止。
- 慢查询未完成时不启动第二个 `getExamStatus()`，避免异步重入。
- `getExamResult(examId)` 原样委托 `DeviceAdapter`，ExamService 不生成、补齐或缓存验光数据。
- 非正数或非有限轮询间隔应在构造时拒绝。

## 后续阶段

检测页面接入、超时策略、异常数据、重复检测、页面刷新和结果为空等场景，在对应功能实现后补充。页面卸载时应调用 `watchExam()` 返回的 cleanup；该行为需要在检测页阶段增加 React 集成测试。

## DeviceAdapter 抽象层

- TypeScript 类型检查覆盖统一接口与领域类型的语法、导入和导出。
- lint 覆盖新增 TypeScript 文件的静态规则。
- 本阶段没有具体 Adapter 行为，因此不伪造连接、取消或结果测试。
- Mock 与 Real Adapter 实现后应共享契约测试，并分别覆盖连接、状态、取消、结果、错误和 `rawData` 保留。
- 未连接时启动检测返回 `DEVICE_NOT_CONNECTED`。
- 已有活动检测时再次启动返回 `DEVICE_BUSY`，且不会创建第二个检测。
- 未知 `examId` 返回 `EXAM_NOT_FOUND`。
- 非 `completed` 检测读取结果返回 `EXAM_NOT_COMPLETED`，不返回空对象或部分结果。
- 已结束检测再次取消返回 `EXAM_ALREADY_FINISHED`；进行中检测取消后状态为 `cancelled`。
- `getExamStatus()` 单次调用只返回一个快照，不遗留内部定时器或无限轮询。
- 所有结果保留 `rawData: unknown`，标准 UI 数据不依赖原始结构。
- 所有时间字段输出可解析的 ISO 8601 字符串。
