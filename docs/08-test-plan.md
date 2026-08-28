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
- 提供“重新检测”“返回首页”和“查看验光报告”；报告入口携带同一 `examId` 导航到 `/report/:examId`。
- 浏览器完整流程覆盖首页连接、启动检测、completed、结果页导航、17 项显示和刷新丢失记录错误。

## 电子验光报告页

- `/report/:examId` 挂载后通过共享 `ExamService.getExamResult(examId)` 读取标准 `ExamResult`，不访问 `MockDeviceAdapter`。
- completed 检测可打开报告，并显示报告展示编号、`examId`、开始/完成时间、数据来源、DEMO MODE 和模拟数据状态。
- 核心屈光结果正确显示 OD / OS 的 SPH、CYL、AXIS，并与 ResultPage 共用屈光度、轴位与时间 formatter。
- 扩展指标只遍历 `ExamResult.metrics` 的实际内容，不通过固定长度数组补齐；`unknown` 只显示“待定义”。
- 页面不读取或渲染 `rawData`；测试用抛错 getter 验证访问原始字段会导致测试失败。
- 报告保留完整模拟数据非医疗用途声明，不显示眼健康评分、疾病风险或诊断结论。
- “打印报告”存在且调用浏览器原生 `window.print()`；不引入 PDF 第三方依赖。
- `@media print` 隐藏按钮、动画、环境光和网页装饰，使用白底深色文字、A4 页边距、可重复表头和避免单行指标被拆分的表格样式；DEMO / 模拟数据声明保留。
- 未知 `examId` 显示“无法生成本次验光报告”和模拟内存记录已不存在提示，不白屏且不显示打印入口。
- 未完成检测显示“本次检测尚未完成，无法生成报告。”，提供返回检测页面和返回首页，不渲染报告。
- ResultPage 点击“查看验光报告”进入同一 `examId` 的 ReportPage，报告页再次通过 ExamService 读取标准结果。

## Mobile Responsive Optimization

- 在 320、360、375、390、414、430 和 768px viewport 分别检查 Home、Exam、Result、Report，不出现页面级横向滚动或卡片超出 viewport。
- Home 在 850px 以下切换为 Brand → Hero → Primary CTA → Device Status Card → Footer 单栏流程；560px 以下 Hero 标题保持 32–42px。
- “连接设备”“开始智能验光”“取消检测”“查看验光结果”“查看验光报告”“打印报告”和返回类按钮至少 44px 高，移动端按钮之间保留间距。
- Exam 在手机端按标题/阶段、扫描视觉、进度、步骤、操作按钮显示；扫描视觉不得宽于卡片内容区。
- Result 在 850px 以下按 OD → OS 单列；metrics 在 320/360px 单列，在 375–560px 紧凑两列，内容允许自然换行而不是省略裁切。
- Report 在 560px 以下隐藏屏幕表格并显示 OD/OS 卡片与 metrics stacked rows；桌面仍显示原表格。
- `examId`、报告编号、指标 code/value 使用任意断行策略，构造长标识时不得撑宽页面。
- viewport meta 只保留一个，包含 `width=device-width`、`initial-scale=1` 和 `viewport-fit=cover`；页面边距使用 iPhone safe-area inset。
- `@media print` 恢复桌面语义表格、隐藏移动端卡片与页面操作，不受手机 screen CSS 影响。
- 复核 1440px Home/Exam/Result/Report 保持桌面布局；本阶段不引入 Playwright 或视觉快照依赖。

## Mock Device 故障控制与诊断

- `normal` 继续通过既有连接、阶段推进、取消、结果、17 项指标和 `rawData` 回归测试。
- `connect_failure` 的 `connect()` 以 `DEVICE_CONNECTION_FAILED` 拒绝；状态不得变为 `connected`，并记录 `DEVICE_CONNECT_FAILED`。
- `start_exam_failure` 只在设备已连接且空闲时以 `EXAM_START_FAILED` 拒绝；不创建 `ExamSession`、`examId` 或 `EXAM_STARTED` 事件，设备保持空闲，切回 `normal` 后可重新启动。
- `exam_error` 先正常返回 `examId`，在准备和左眼阶段后进入标准 `ExamStatus.stage = error`；设备释放，`getExamResult()` 仍以 `EXAM_NOT_COMPLETED` 拒绝，并记录关联 `examId` 的 `EXAM_FAILED`。
- `status_query_failure` 的 `getExamStatus()` 以 `DEVICE_COMMUNICATION_ERROR` 拒绝，不伪造 `ExamStatus.error`；通过真实 `ExamService.watchExam()` 验证 observer `onError` 被调用且轮询停止。
- `reset()` 把场景恢复为 `normal`，清理连接故障留下的错误/在途连接状态，之后可以正常连接；不把历史失败会话改写为成功。
- 正常连接至少生成 `DEVICE_CONNECT_REQUEST` 与 `DEVICE_CONNECTED`；启动和阶段事件在存在 `examId` 时可以关联同一标识。
- 每条诊断事件包含可解析的 ISO 8601 `timestamp`、`type` 和 `message`，可选 `examId` / `stage`；不包含患者信息。
- 诊断事件超过配置上限后只保留最近事件；默认上限 100，测试使用较小注入上限验证最早事件被移除，并覆盖显式清理。
- `MockDeviceControl` / `MockDeviceDiagnostics` 不加入 `DeviceAdapter`，React 业务页面与 ExamService 不依赖它们。
- HomePage、ExamPage、ResultPage、ReportPage 继续不读取 `rawData`；本阶段不改变既有不可见 sentinel / 抛错 getter 覆盖。

## 后续阶段

整体超时策略、异常数据、重复检测和结果为空等场景，在对应功能实现后补充。

## DeviceAdapter 抽象层

- TypeScript 类型检查覆盖统一接口与领域类型的语法、导入和导出。
- lint 覆盖新增 TypeScript 文件的静态规则。
- 当前 Mock 测试覆盖连接、状态、取消、结果、确定性故障、诊断事件和 `rawData` 保留；未来 Real Adapter 应在取得正式资料后共享正式契约测试，但不实现 Mock 专用控制测试。
- 未连接时启动检测返回 `DEVICE_NOT_CONNECTED`。
- 已有活动检测时再次启动返回 `DEVICE_BUSY`，且不会创建第二个检测。
- 未知 `examId` 返回 `EXAM_NOT_FOUND`。
- 非 `completed` 检测读取结果返回 `EXAM_NOT_COMPLETED`，不返回空对象或部分结果。
- 已结束检测再次取消返回 `EXAM_ALREADY_FINISHED`；进行中检测取消后状态为 `cancelled`。
- `getExamStatus()` 单次调用只返回一个快照，不遗留内部定时器或无限轮询。
- 所有结果保留 `rawData: unknown`，标准 UI 数据不依赖原始结构。
- 所有时间字段输出可解析的 ISO 8601 字符串。
