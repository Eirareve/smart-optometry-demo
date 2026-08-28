# 测试计划

## Phase 1 首页

- 显示“智能验光系统”标题。
- 显示 DEMO MODE。
- 初始显示 Mock Device 未连接和“暂无通信”，“开始智能验光”按钮不可用。
- 点击“连接设备”后展示连接中、`Smart Optometry Mock Device`、`MOCK-OPT-001`、最后通信时间和已连接状态。
- 只有设备为 `connected + idle` 时启用“开始智能验光”。
- 点击“开始智能验光”通过 ExamService 创建会话并进入 `/exam/:examId`；启动失败显示可见错误且允许重试。

## 模拟验光进行页

- 正常状态按 `preparing → left_eye → right_eye → analyzing → completed` 实时呈现。
- 每个阶段同步更新百分比、左眼、右眼和数据分析状态，并始终显示 `examId` 与 DEMO MODE。
- `completed` 显示“检测完成”、“查看验光结果”主按钮和返回首页入口；点击后携带同一 `examId` 进入 `/results/:examId`。
- 点击“取消检测”只调用 ExamService；收到真实 `cancelled` 快照后显示“检测已取消”并允许返回首页。
- Adapter 返回 `error` 终态时停留在检测页，显示异常说明和返回首页入口。
- 直接打开 Mock 内存中不存在的 `examId` 时显示清晰错误，不白屏。
- React 页面卸载时调用 `watchExam()` 返回的 cleanup。
- 页面不导入或调用 `MockDeviceAdapter`，也不创建 `setInterval` 或其他设备轮询 timer。

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

## 验光结果页

- `/results/:examId` 挂载后只调用 `ExamService.getExamResult(examId)`，不直接访问 `MockDeviceAdapter`。
- 加载 Promise 未完成时显示明确 loading 状态，不提前渲染结果。
- completed 结果正确显示 OD / OS 的 SPH、CYL、AXIS；正数带 `+`、负数保留 `-`、零显示 `0.00 D`，AXIS 使用合理数字格式并带 `°`。
- Mock 标准结果显示 OD `-2.50 D / -0.75 D / 175°` 与 OS `-2.75 D / -0.50 D / 10°`。
- 17 项扩展指标全部直接来自 `ExamResult.metrics`，显示中性名称、值和“待定义”，页面不创建固定 17 项。
- `source: mock` 显示 `Mock Device`、`DEMO MODE` 和“模拟数据”。
- 页面显示 `examId`、开始时间、完成时间及完整非医疗用途声明。
- 页面不显示或依赖 `rawData`；测试使用不可见 sentinel 验证原始结构不会渲染。
- 未知 `examId` / 刷新后内存记录丢失显示“无法读取本次检测结果”，不白屏。
- 未完成检测返回 `EXAM_NOT_COMPLETED` 时显示“检测尚未完成”，不生成假结果。
- 提供“重新检测”和“返回首页”；报告按钮仅为 disabled 的下一阶段占位，不存在报告路由。
- 浏览器完整流程覆盖首页连接、启动检测、completed、结果页导航、17 项显示和刷新丢失记录错误。

## 后续阶段

整体超时策略、异常数据、重复检测、结果为空和报告页等场景，在对应功能实现后补充。

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
