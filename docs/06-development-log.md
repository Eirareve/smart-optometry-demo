# 开发日志

## 2026-08-29 — Vercel 部署准备

### 本次目标

只完成 React + TypeScript + Vite 单页应用的 Vercel 部署准备：增加 BrowserRouter deep-link rewrite、核对生产构建与本地预览、补充部署说明；不修改业务 UI、设备逻辑或项目依赖，不执行 Git commit。

### 完成内容

- 在项目根目录新增最小化 `vercel.json`，只配置 `/(.*)` 到 `/index.html` 的 SPA rewrite，并声明 Vercel 配置 schema。
- 未加入旧式 `builds`、`routes` 或其他不必要的部署覆盖配置。
- 核对 `package.json`：现有 `build` 与 `preview` 脚本满足本次验证，Vercel 可按 Vite 项目默认行为安装依赖、执行构建并发布静态输出；未增加 Vercel CLI 或其他依赖。
- README 新增 Deployment 部分，记录 Vercel 托管目标、`main` 对应 Production、Pull Requests 对应 Preview，以及 SPA rewrite 用途；当前没有填写或虚构正式 URL。
- 核对现有 BrowserRouter 路由：`/`、`/exam/:examId`、`/results/:examId`、`/report/:examId`；当前项目没有 `/developer/device`。

### 我做出的决策

- 采用 Vercel 官方 Vite SPA 文档给出的单条 rewrite，不覆盖框架检测、安装命令、构建命令或输出目录。
- rewrite 保持浏览器地址不变，仅由 Vercel 返回 `/index.html`，再交给 React Router 按当前 URL 匹配页面。
- 不安装 `vercel` 包；Git 集成部署和 Vercel 的 Vite 自动检测不要求把 CLI 加入应用依赖。

### Codex 辅助内容

- 完整阅读项目规划和仓库约束，核对路由、Vite 配置、npm scripts、依赖树与当前工作区状态。
- 查阅 Vercel 官方 Vite、rewrite、build 与 deployment environment 文档，确认当前最小配置。
- 创建部署配置、更新 README 和本开发日志，并执行本地构建、预览和完整项目验证。

### 我人工检查/修改的内容

尚未记录，等待项目负责人检查。

### 测试结果

- `vercel.json` JSON 解析：通过。
- `npm run build`（预览前）：通过；Vite 完成 92 个模块转换并生成 `dist`。
- `npm run preview`：通过；本地服务器在 `127.0.0.1:4173` 启动成功，`/`、`/exam/EX-DEMO-PREVIEW`、`/results/EX-DEMO-PREVIEW`、`/report/EX-DEMO-PREVIEW` 均返回 HTTP 200 和 SPA 根文档，验证后已停止服务器。
- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test`：通过；7 个测试文件、64 个测试全部通过。
- `npm run build`（最终）：通过；Vite 完成 92 个模块转换。
- Vite build、preview 和 Vitest 首次在受限 Windows 沙箱内因子进程 `spawn EPERM` 无法加载配置；获准在沙箱外重跑后均通过，该环境限制与代码或断言失败无关。

### 未解决问题

- 当前尚未创建或连接正式 Vercel 项目，因此没有正式 Production URL，也未进行线上域名与 Vercel 构建日志验证。
- Mock Device 检测记录仍只存在于浏览器内存；直接打开或刷新带 `examId` 的页面时，SPA 路由可以加载，但既有内存检测记录仍可能不存在。这是现有 Demo 数据生命周期，不属于本次部署配置范围。

### 下一步

将仓库导入 Vercel 并确认 Framework Preset 为 Vite；让 `main` 触发 Production 部署、Pull Request 触发 Preview 部署后，分别直接访问并刷新 `/exam/:examId`、`/results/:examId` 和 `/report/:examId`，核对 rewrite 与页面自身的内存记录提示。

## 2026-08-29 — Mobile Responsive Optimization

### 本次目标

只优化现有浅蓝主题在手机浏览器中的完整 Demo 操作体验，覆盖 320、360、375、390、414、430 和 768px，同时保持桌面与打印布局正常；不引入大型依赖、不增加视觉测试框架、不修改设备/业务架构、不执行 Git commit。

### 完成内容

- 保留桌面左右布局，在 `850px` 以下把 Home、Exam 和 Result 核心内容切换为单栏；在 `560px` 以下完成手机紧凑布局，在 `375px` 以上为 Result metrics 使用紧凑两列，320/360px 保持单列。
- Home 手机端按 Brand、Hero、Primary CTA、Device Status Card、Footer 顺序自然纵向排列；Hero 标题限制为 32–42px，主 CTA 占满可用宽度。
- Exam 手机端按标题/阶段、扫描视觉、进度、步骤、操作按钮显示；扫描视觉受卡片内宽约束，进度和步骤先于检测编号，所有检测操作按钮满足至少 44px 高。
- Result 手机端 OD 在前、OS 在后；SPH/CYL/AXIS 改为清晰的横向 label/value 行，metrics 在 320/360px 单列、375–430px 两列、768px 两列。
- Report 手机端将 OD/OS 表格替换为两张纵向结果卡，将 metrics 表格替换为 stacked rows；桌面继续显示表格，`@media print` 明确恢复打印表格并隐藏移动卡片。
- 所有主要操作按钮设置 `min-height: 44px` 和合理间距；长 `examId`、报告编号、指标 code/value 使用 `overflow-wrap: anywhere`。
- 移除根节点 `320px` 最小宽度，约束 shell 为 viewport 宽度并裁切装饰性环境光；页面内部不产生横向滚动。
- 现有 viewport meta 更新为 `width=device-width, initial-scale=1, viewport-fit=cover`，为页面左右边距、顶部栏与底部操作区域加入 iPhone safe-area inset。
- 当前仓库没有 Developer Diagnostics 页面，因此本阶段没有新增该页面。

### 我做出的决策

- 使用 `850px`、`560px` 和 `375px` 三个轻量断点，不引入响应式依赖；850px 负责桌面到单栏，560px 负责手机布局，375px 负责 metrics 单列/两列平衡。
- 手机报告采用 stacked cards/rows，而不是保留 42rem 宽的长距离横向滚动；桌面和打印继续使用语义表格。
- safe area 只增加页面边距与底部留白，不创建固定底栏，避免遮挡内容或改变现有交互结构。

### Codex 辅助内容

- 核对所有产品页面、共用结果/报告组件、viewport 和现有打印 CSS，在不覆盖当前浅蓝主题及其他未提交改动的前提下增量修改。
- 使用真实浏览器 viewport 逐一检查 320、360、375、390、414、430、768px 的 Home、Exam、Result、Report 页面宽度、布局、按钮高度、长编号换行和横向溢出。
- 完整走通手机端连接设备、开始检测、查看结果、查看报告流程，并复核 1440px Home、Exam、Report 桌面网格未退化。

### 我人工检查/修改的内容

尚未记录，等待项目负责人检查。

### 测试结果

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test`：通过；7 个测试文件、64 个测试全部通过。
- `npm run build`：通过；Vite 完成 92 个模块转换。
- 浏览器 viewport 检查：320、360、375、390、414、430、768px 均无页面级横向滚动；主要按钮实测约 47–67px 高。
- Vitest、Vite build 和本地预览在受限 Windows 沙箱内首次因子进程 `spawn EPERM` 无法启动；在沙箱外重跑后通过，该问题与代码或断言失败无关。

### 未解决问题

- 本阶段按要求未引入 Playwright 或截图比对测试；响应式验收使用真实浏览器 viewport 手工检查。
- 厂家接口、真实设备接入和 17 项正式字段定义仍为 `TBD`。

### 下一步

可在 Vercel 预览环境使用真实 iPhone/Android 浏览器复核系统字体、浏览器地址栏收缩和打印机驱动差异；若发现具体机型问题，再做小范围兼容修正。

## 2026-08-28 — Mock Device 故障场景控制与诊断基础能力

### 本次目标

只为 `MockDeviceAdapter` 增加与正式 `DeviceAdapter` 分离的确定性故障控制和有界内存诊断事件，覆盖 `normal`、连接失败、启动失败、检测终态错误和状态查询失败；不创建 Developer 页面，不修改现有业务页面视觉，不接入真实厂家 API，不增加数据库，不改变普通页面对 `rawData` 的边界，不执行 Git commit。

### 完成内容

- 新增独立 `MockDeviceControl`，提供 `getScenario()`、`setScenario()` 和 `reset()`；`DeviceAdapter` 仍保持原有 7 个厂家无关方法。
- 支持 `normal`、`connect_failure`、`start_exam_failure`、`exam_error` 和额外的 `status_query_failure`，全部为显式选择、可重复测试的确定性行为，不使用随机故障。
- `connect_failure` 以 `DEVICE_CONNECTION_FAILED` 拒绝并保持非连接状态；`start_exam_failure` 以 `EXAM_START_FAILED` 拒绝且不创建会话；`exam_error` 正常创建 `examId`，在准备和左眼阶段后进入标准 `error` 终态；`status_query_failure` 以 `DEVICE_COMMUNICATION_ERROR` 拒绝状态查询并触发 ExamService `onError`。
- 新增独立 `MockDeviceDiagnostics` 和 `MockDiagnosticEvent`，记录连接请求/成功/失败、检测启动请求/成功/失败、阶段变化、取消、检测失败、状态查询失败、断开和重置。
- 每条诊断事件包含 ISO 8601 `timestamp`、`type`、安全 `message`，检测事件按需携带 `examId` 和 `stage`；读取返回副本，支持显式清理。
- 诊断事件只保存在 Mock 实例内存中，默认最多保留最近 100 条，超过上限时删除最早事件；测试可注入更小的正整数上限。
- `reset()` 恢复 `normal`，并把连接失败留下的 `error` / 未完成连接尝试恢复为干净的 `disconnected`；历史终态不被改写，诊断事件也不会被隐式清空。
- 新增我方 Demo/Adapter 层安全错误码 `DEVICE_CONNECTION_FAILED`、`EXAM_START_FAILED`、`DEVICE_COMMUNICATION_ERROR`，文档明确其不是厂家真实错误码。
- 扩展 MockDeviceAdapter 与 ExamService 测试，覆盖全部场景、恢复、事件关联、事件容量上限和真实 observer `onError` 路径；原有测试保持通过。
- 同步架构、设备接入、API Contract、技术决策和测试计划文档；Developer 页面、业务页面和 `rawData` 定位均未修改。

### 我做出的决策

- `MockDeviceAdapter` 可以同时实现 `DeviceAdapter`、`MockDeviceControl` 与 `MockDeviceDiagnostics`，但应用装配继续以 `DeviceAdapter` 注入 ExamService，业务页面无法访问 Mock 专用接口。
- `exam_error` 与标准检测终态保持一致，状态查询成功返回 `stage: error`；`status_query_failure` 是查询 Promise 拒绝，两者不混为同一种错误。
- 诊断日志使用简单有界数组，不引入 logging framework、第三方依赖、持久化或患者数据。
- 场景重置与日志清理分开：`reset()` 用于恢复正常行为，`clearDiagnosticEvents()` 用于明确清空诊断证据。
- `ExamResult.rawData` 结构和用途不变；HomePage、ExamPage、ResultPage 与 ReportPage 继续不读取它。

### Codex 辅助内容

- 完整阅读项目规划、代理约束、架构、设备接入说明、API Contract、既有开发日志和测试计划，并复核当前分支与干净工作区。
- 实现 Mock-only 控制/诊断类型、确定性故障行为、错误模型、事件容量限制、统一导出、自动化测试和相关文档。
- 复核正式契约未增加 Demo 方法、React 页面未依赖 Mock 控制、诊断事件不含患者信息、故障不生成假结果且 `rawData` 边界未变化。
- 执行 lint、typecheck、定向测试、完整测试和生产构建。

### 我人工检查/修改的内容

尚未记录，等待项目负责人检查。

### 测试结果

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- 定向测试：通过；2 个测试文件、32 个测试全部通过。
- `npm test`：通过；7 个测试文件、64 个测试全部通过。
- `npm run build`：通过；Vite 完成 92 个模块转换。
- Vitest 与 Vite build 在受限 Windows 沙箱内首次因子进程 `spawn EPERM` 无法启动；获准在沙箱外重跑后均通过，该环境限制与代码或断言失败无关。

### 未解决问题

- 本阶段按要求没有创建 Developer 页面，因此故障控制与诊断能力当前只可由代码和测试访问。
- 日志为纯内存并随 Mock 实例生命周期消失，不做数据库、文件或远程持久化。
- 真实硬件、厂家 API、SDK、DLL、协议、厂家错误码、真实通信日志和 17 项正式字段映射仍为 `TBD`。

### 下一步

等待后续明确授权后，可让 Developer / Debug 页面从专用装配边界取得 `MockDeviceControl` 与 `MockDeviceDiagnostics`；普通业务页面与 ExamService 继续只依赖正式 `DeviceAdapter` 流程。

## 2026-08-28 — 电子验光报告与浏览器打印

### 本次目标

只实现 `/report/:examId`、ReportPage 和浏览器原生打印：从 ResultPage 进入报告页，通过共享 `ExamService.getExamResult(examId)` 获取标准 `ExamResult`，展示基础信息、OD/OS 核心屈光结果、动态扩展指标、模拟数据声明、加载与错误状态，并提供适合 A4 的 `@media print` 样式；不实现服务端 PDF、jsPDF、html2canvas、AI 分析、医疗诊断、疾病风险、数据库、用户系统、真实患者信息或厂家 API，不执行 Git commit。

### 完成内容

- 新增 `/report/:examId` 路由和 `ReportPage`；页面从应用级 Context 获取共享 ExamService，并按自己的生命周期调用 `ExamService.getExamResult(examId)`。
- ResultPage 原 disabled 的“生成报告（下一阶段）”已改为可点击的“查看验光报告”，携带同一不透明 `examId` 导航到报告页。
- 报告展示“智能验光报告”、DEMO MODE、“模拟数据”、Demo 展示用报告编号、`examId`、检测开始/完成时间和数据来源；展示编号只以 `DEMO-RPT-` 拼接 `examId`，并明确不是数据库或真实医疗报告编号。
- 新增 `ReportEyeTable`，以报告表格展示 OD / OS 的 SPH、CYL、AXIS；新增 `ReportMetricTable`，只遍历 `ExamResult.metrics` 的实际内容，不创建固定 17 项。
- `unknown` 扩展指标只显示“待定义”；没有添加正常、异常、健康、风险、疾病解释或眼部健康评分。
- 报告的检测摘要只陈述已采集左右眼核心屈光数据与扩展检测指标；完整声明明确模拟数据不构成医疗诊断、验光处方、疾病筛查或治疗建议。
- “打印报告”只调用 `window.print()`；同时提供“返回验光结果”和“返回首页”。项目没有新增 PDF 或截图依赖。
- 新增专门 `@media print`：设置 A4 与 12mm 页边距，隐藏操作按钮、动画、ambient glow 和网页装饰，移除阴影与透明背景，切换白底深色文字，保留 DEMO / 模拟数据标识和声明，并为指标表格设置可重复表头、自动换行及避免单行被拆分。
- `EXAM_NOT_FOUND` 显示“无法生成本次验光报告”和“当前模拟检测记录已不存在，请返回首页重新检测。”；`EXAM_NOT_COMPLETED` 显示“本次检测尚未完成，无法生成报告。”并提供返回检测页面与首页。
- 提取 `formatDiopter()`、`formatAxis()`、`formatExamTime()`、数据来源和扩展指标格式化到 `src/utils/examFormatters.ts`，ResultPage、EyeResultCard、MetricGrid 与报告组件共用同一套逻辑。
- 新增 ReportPage 9 个测试、formatter 4 个测试，并为 ResultPage 增加报告导航测试；`rawData` 测试使用访问即抛错的 getter，确认 ReportPage 不读取其内容。
- 同步 README、产品范围、架构、设备接入、API Contract 与测试计划。

### 我做出的决策

- 现有 DeviceAdapter 与 ExamService contract 已满足报告页，因此不修改领域模型、Adapter、Mock 数据或流程服务。
- ResultPage 和 ReportPage 都根据各自页面生命周期调用 `getExamResult(examId)`；报告页不复用组件内存中的结果对象，也不从 Mock 内部状态生成报告。
- 只提取页面间确实重复的轻量 formatter；报告采用语义化表格组件以兼顾屏幕科技风和打印可读性，没有引入复杂报告抽象或 PDF 排版库。
- 报告编号明确标记为 Demo 展示编号，只拼接不透明 `examId`，不解析其格式，不创建数据库 ID。
- 页面只使用标准字段 `examId`、`source`、`rightEye`、`leftEye`、`metrics`、`startedAt`、`completedAt`；`rawData` 继续由 Adapter 保留但不属于报告 UI 数据源。

### Codex 辅助内容

- 完整阅读项目规划、代理约束、产品范围、架构、设备接入说明、API Contract、既有开发日志和测试计划。
- 复核当前分支、干净工作区、路由、ResultPage、结果组件、共享依赖、ExamService 和测试结构。
- 实现报告页面、报告专用表格、共享 formatter、浏览器打印入口、打印样式、错误与加载状态、自动化测试和文档更新。
- 执行 lint、typecheck、完整测试和生产构建，并检查 diff whitespace、禁用范围、`rawData`/Mock 依赖与固定指标生成。

### 我人工检查/修改的内容

尚未记录，等待项目负责人检查。

### 测试结果

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test`：通过；7 个测试文件、56 个测试全部通过，其中 ReportPage 9 个测试、共享 formatter 4 个测试、ResultPage 新增 1 个报告导航测试。
- `npm run build`：通过；Vite 完成 91 个模块转换。
- 定向测试：通过；ReportPage、ResultPage 和 formatter 共 3 个测试文件、20 个测试全部通过。
- Vitest 与 Vite build 在受限 Windows 沙箱内因子进程 `spawn EPERM` 无法启动；在获准的沙箱外环境重跑后均通过，该限制与代码或断言失败无关。

### 未解决问题

- Mock Device 检测记录仍只存在于内存中，浏览器完整刷新后可能丢失；报告页已明确提示并提供返回首页入口，没有增加持久化或数据库。
- 浏览器打印效果最终仍受用户浏览器、纸张、页边距和“背景图形”打印选项影响；当前只提供标准 CSS 打印版式，不生成独立 PDF 文件。
- 真实硬件、厂家 API、SDK、DLL、协议、厂家错误码和 17 项正式字段映射仍为 `TBD`。

### 下一步

等待项目负责人验收本阶段；未获后续任务授权前，不增加服务端 PDF、AI 医疗分析、持久化、用户系统或真实设备接入。

## 2026-08-28 — 验光结果页面

### 本次目标

只实现 `/results/:examId` 与 ResultPage：让 completed ExamPage 导航到结果页，通过共享 `ExamService.getExamResult(examId)` 获取标准 `ExamResult`，展示左右眼屈光数据、17 项扩展指标、时间、来源、模拟数据声明与错误状态；不开发 ReportPage、PDF、AI 分析、真实厂家 API 或数据库，不修改 DeviceAdapter contract，不执行 Git commit。

### 完成内容

- 新增 `/results/:examId` 路由和 `ResultPage`，页面从应用级 Context 获取共享 ExamService，不导入或调用 `MockDeviceAdapter`。
- ExamPage 的 `completed` 状态新增“查看验光结果”主按钮，携带同一不透明 `examId` 导航到结果页；取消与错误终态仍不提供结果入口。
- ResultPage 挂载后调用 `ExamService.getExamResult(examId)`；加载期间显示明确 loading，成功后只消费标准结果字段。
- 新增 `EyeResultCard`，分栏展示 OD / OS 的 SPH、CYL、AXIS；屈光度正数带 `+`、负数保留 `-`、零显示 `0.00 D`，AXIS 使用合理数字格式并带 `°`。
- Mock 结果正确显示 OD `-2.50 D / -0.75 D / 175°` 与 OS `-2.75 D / -0.50 D / 10°`。
- 新增 `MetricGrid`，直接遍历 `ExamResult.metrics`；当前 17 项全部显示 Adapter 提供的中性名称和值，`unknown` 显示“待定义”，页面不自行创建指标或生成医学判断。
- 页面显示 `examId`、检测开始时间、检测完成时间和 `source: mock` 对应的 `Mock Device`，顶部同时显示 `DEMO MODE` 与“模拟数据”。
- 页面底部显示完整模拟数据非医疗用途声明，提供“重新检测”“返回首页”和 disabled 的“生成报告（下一阶段）”；没有创建报告路由或真实功能。
- `EXAM_NOT_FOUND` 显示“无法读取本次检测结果”和内存记录已不存在说明；`EXAM_NOT_COMPLETED` 显示“检测尚未完成”，不返回假结果；其他读取失败也有可返回首页的错误状态。
- 新增 ResultPage 6 个测试，并补充 ExamPage completed 导航测试；同步 README、产品范围、架构、设备接入、API Contract 与测试计划。

### 我做出的决策

- 现有 DeviceAdapter 与 ExamService contract 能完整支持本阶段，没有发现明确 Bug，因此不修改任何 contract、领域类型或 Mock 底层数据结构。
- 页面结果状态按路由 `examId` 关联，并用请求版本让卸载、StrictMode 重挂载或参数变化后的旧 Promise 失效，避免旧结果覆盖新页面。
- 17 项扩展指标完全以 `ExamResult.metrics` 为输入；组件只格式化已有的 `value`、可选 `unit` 和状态文案，不补齐数量、不改名、不解释医学意义。
- `rawData` 继续由 Adapter 保留，但 ResultPage 不引用该字段；它不是标准 UI 字段缺失时的回退来源。
- 报告入口只保留 disabled 布局占位，避免用户误以为 ReportPage 或 PDF 已实现。

### Codex 辅助内容

- 完整阅读项目规划、代理约束、产品范围、架构、设备接入说明、API Contract、既有开发日志及相关源码与测试。
- 实现结果页、可复用结果组件、路由、completed 导航、响应式医疗科技风样式、加载与错误状态、自动化测试和文档更新。
- 使用本地浏览器实际验证首页连接、启动检测、完整阶段、结果页导航、OD/OS 数值、17 项指标、刷新后内存记录丢失错误和 390px 窄屏布局；控制台无 warning/error，页面无横向溢出。
- 执行 lint、typecheck、完整测试和生产构建，并复核 diff、范围与术语。

### 我人工检查/修改的内容

尚未记录，等待项目负责人检查。

### 测试结果

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test`：通过；5 个测试文件、42 个测试全部通过，其中 ResultPage 新增 6 个测试，ExamPage 新增 completed → ResultPage 导航覆盖。
- `npm run build`：通过；Vite 完成 87 个模块转换。
- 浏览器实际流程：通过；首页连接 → 启动检测 → `/exam/:examId` → completed → `/results/:examId`，标准数据、操作入口与刷新错误均符合预期。
- 响应式视觉检查：桌面与 390px 窄屏通过；窄屏文档宽度未超出视口，浏览器控制台无错误或警告。
- Vitest、Vite dev server 和生产构建在受限沙箱内因子进程 `spawn EPERM` 无法启动；在获准的沙箱外环境重跑后均通过，该限制与代码或断言失败无关。

### 未解决问题

- ReportPage、PDF 和 AI 分析按本次范围未开发；“生成报告（下一阶段）”保持禁用。
- Mock Device 记录仍只存在于内存中，浏览器完整刷新会丢失会话；结果页已明确提示，但未增加持久化或数据库。
- 真实硬件、厂家 API、SDK、DLL、协议、厂家错误码和 17 项正式字段映射仍为 `TBD`。

### 下一步

等待后续阶段明确授权后再实现 ReportPage；在此之前不增加报告路由、PDF、AI 分析或真实设备接入。

## 2026-08-28 — 模拟验光进行页

### 本次目标

实现首页启动模拟检测、`/exam/:examId` 路由和 ExamPage：通过共享 ExamService 实时呈现 `preparing → left_eye → right_eye → analyzing → completed`，支持取消、错误、页面刷新后内存会话丢失与组件卸载 cleanup；不开发结果页、报告页或真实厂家 API，不执行 Git commit。

### 完成内容

- 首页只在设备为 `connected + idle` 时启用“开始智能验光”；点击后调用 `ExamService.startExam()`，取得 Adapter 返回的不透明 `examId` 并导航到 `/exam/:examId`。
- 新增 `/exam/:examId` 路由和 `ExamPage`，页面从应用级 Context 获取共享 ExamService，不导入或调用 `MockDeviceAdapter`。
- ExamPage 通过 `ExamService.watchExam()` 获取状态，不创建 `setInterval` 或其他轮询 timer；effect cleanup 调用服务返回的清理函数。
- 页面实时显示当前检测阶段、进度百分比、左眼状态、右眼状态、数据分析状态、`examId`、DEMO MODE 和非医疗诊断声明。
- `completed` 只显示“检测完成”和返回首页入口，不读取结果、不导航到结果页。
- “取消检测”只调用 `ExamService.cancelExam(examId)`；收到 Adapter 的真实 `cancelled` 快照后显示“检测已取消”并允许返回首页。
- Adapter 返回的 `error` 终态与状态查询拒绝分别处理；直接访问 Mock 内存中不存在的 `examId` 时显示清晰的刷新/内存会话错误，不白屏。
- 首页新增检测启动中、设备忙和启动失败反馈；浏览器返回首页时会依据标准 `DeviceStatus.operatingState` 决定是否允许再次启动。
- 新增 ExamPage 5 个 React 集成测试，并把 HomePage 测试扩展到启动导航和启动失败；同步 README、产品范围、架构、API Contract 和测试计划。

### 我做出的决策

- 路由只保存 Adapter 返回的 `examId`，页面不解析其生成规则；写入 URL 时使用 `encodeURIComponent`，读取使用 React Router 动态参数。
- 检测状态轮询继续全部留在 ExamService；React effect 只负责订阅与 cleanup，页面状态按 `examId` 标记，避免参数变化时渲染旧会话快照。
- 取消成功后的 `cancelled`、Adapter 标准 `error` 和查询 Promise 拒绝不合并为同一种错误；页面分别给出已取消、检测异常和无法读取记录的反馈。
- `progress: null` 的取消或错误终态保留最近一次可用进度；直接打开终态记录但没有历史快照时显示 0%，不虚构进度。
- 本阶段不调用 `getExamResult()`，也不创建 ResultsPage 或 ReportPage。

### Codex 辅助内容

- 完整阅读 `PROJECT_PLAN.md`、`AGENTS.md`、架构、API Contract 和开发日志，复核现有 HomePage、应用级依赖、ExamService、MockDeviceAdapter 与测试。
- Context7 MCP 在当前环境不可用，改用 React Router 官方文档核对 `useNavigate`、`useParams` 和动态路由用法。
- 实现页面、路由、状态映射、取消/错误处理、响应式医疗科技风样式、测试和文档。
- 使用本地浏览器实际点击验证首页连接、启动、动态路由、完整阶段完成和丢失 `examId` 错误页；检查桌面与 390px 窄屏布局，浏览器控制台无 warning/error。
- 执行 lint、typecheck、完整测试和生产构建。

### 我人工检查/修改的内容

尚未记录，等待项目负责人检查。

### 测试结果

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test`：通过；4 个测试文件、35 个测试全部通过，其中 ExamPage 5 个测试、HomePage 6 个测试。
- `npm run build`：通过；Vite 完成 84 个模块转换。
- 浏览器实际流程：通过；首页连接 → 启动检测 → `/exam/:examId` → 完成，以及未知 `examId` 错误页均符合预期。
- 响应式视觉检查：桌面与 390px 窄屏通过；浏览器控制台无错误或警告。
- Vitest、Vite dev server 和生产构建在受限沙箱内会因子进程 `spawn EPERM` 无法启动；在获准的沙箱外环境重跑后均通过，该限制与代码或断言失败无关。

### 未解决问题

- ResultsPage 和 ReportPage 按本次范围未开发；检测完成后只显示终态。
- 当前检测记录只存在于 Mock Device 内存中，浏览器完整刷新会丢失会话；页面已明确提示，但未增加持久化。
- 真实硬件、厂家 API、SDK、DLL、协议、厂家错误码和 17 项正式字段映射仍为 `TBD`。

### 下一步

等待后续阶段明确授权后，再实现 ResultsPage，并在 `completed` 后按页面生命周期调用 `ExamService.getExamResult(examId)`；报告页继续等待独立阶段。

## 2026-08-28 — 首页接入共享 Mock Device / ExamService

### 本次目标

只把现有首页接入 `MockDeviceAdapter` 和已完成的 `ExamService`：展示未连接、连接中、连接成功、DeviceInfo、最后通信时间和可见错误，并在连接成功后启用“开始智能验光”；不创建检测页、结果页或报告页，不接入真实厂家 API，不执行 Git commit。

### 完成内容

- 新增应用级依赖装配模块，只创建一个 `MockDeviceAdapter`，并注入一个共享 `ExamService`。
- 在 Router 外增加轻量 React Context Provider；当前和未来页面可取得同一个 ExamService，页面切换不会重建 Adapter。
- 首页挂载时通过 `ExamService.getDeviceStatus()` 读取标准设备状态，不直接导入或调用具体 Adapter。
- 点击“连接设备”后立即显示“正在连接”，再调用 `ExamService.connect()`；成功后展示 Adapter 返回的 `Smart Optometry Mock Device`、`MOCK-OPT-001`、已连接状态和格式化后的最后通信时间。
- 只有设备标准状态为 `connected` 时启用“开始智能验光”；本阶段没有给按钮添加检测启动或页面跳转行为。
- 连接失败或初始状态读取失败时显示可见 `role="alert"` 提示，连接失败后仍可重试。
- 保留首页原有结构、文案层级、响应式布局、DEMO MODE 和“当前未接入真实设备”声明，只补充连接状态色、启用态和错误样式。
- 更新 HomePage 测试，覆盖初始未连接、连接中、连接成功、DeviceInfo、通信时间更新、按钮启用、错误重试，以及页面卸载再进入后共享连接状态仍存在。
- 同步 README、架构、设备接入、API Contract 和技术决策文档；未新增 ExamPage、ResultsPage 或报告页。

### 我做出的决策

- `MockDeviceAdapter` 在 `src/app/dependencies.ts` 的模块作用域创建，而不是在 React 组件、Provider render 或 ExamService 内创建。
- Context 只向页面暴露共享 `ExamService`，不暴露具体 Adapter，继续维持 UI → ExamService → DeviceAdapter 的依赖方向。
- 使用模块级单例加 Router 外层 Context 满足当前依赖生命周期，不引入 Redux。
- 首页连接状态继续使用标准 `DeviceConnectionState`，不把设备连接状态混入单次检测的 `ExamStatus`。
- 页面返回首页时若发现共享设备已经连接，通过 Mock Adapter 的幂等 `connect()` 重新取得 DeviceInfo，再刷新设备快照；不复制或解析 Adapter 内部的检测记录。

### Codex 辅助内容

- 完整阅读 `PROJECT_PLAN.md`、项目约束和现有 DeviceAdapter、MockDeviceAdapter、ExamService、首页与测试。
- 实现应用级装配、Context 提供、首页状态消费、错误反馈、视觉状态和测试。
- 复核单实例创建位置、页面切换生命周期、连接请求竞态和卸载后的异步响应失效。
- 更新相关文档并执行代码检查、类型检查、完整测试和生产构建。

### 我人工检查/修改的内容

尚未记录，等待项目负责人检查。

### 测试结果

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test`：通过；3 个测试文件、28 个测试全部通过，其中 HomePage 4 个测试。
- `npm run build`：通过；Vite 完成 83 个模块转换。
- HomePage 回归测试：4 个测试全部通过。
- Vitest 首次在受限沙箱内因 Vite 子进程 `spawn EPERM` 无法启动；获准在沙箱外重跑后通过。生产构建也在沙箱外执行并通过，该环境限制与代码或断言失败无关。

### 未解决问题

- “开始智能验光”现在会在 Mock Device 连接后启用，但本阶段按范围没有启动检测或导航。
- 检测页、结果页和报告页仍未创建。
- 真实硬件、厂家 API、SDK、DLL、协议、厂家错误码和 17 项正式字段映射仍为 `TBD`。

### 下一步

等待后续阶段明确授权后，再让检测页从同一 Context 获取共享 ExamService、调用 `startExam()` 并保存 Adapter 返回的不透明 `examId`；不在页面创建新的 Adapter 或轮询器。

## 2026-08-28 — ExamService 验光流程编排层

### 本次目标

只在 React 页面与 `DeviceAdapter` 之间实现 `ExamService`，负责连接业务入口、启动检测、状态轮询、主动取消、终态停止和订阅清理；不修改首页 UI，不创建检测、结果或报告页面，不接入真实设备、厂家 API 或数据库。

### 完成内容

- 新增构造注入 `DeviceAdapter` 的 `ExamService`，没有在服务内部创建或判断具体设备实现。
- 提供 `connect()`、`disconnect()`、`getDeviceStatus()`、`startExam()`、`watchExam()`、`cancelExam()`、`getExamResult()` 和 `dispose()`。
- `startExam()` 原样返回 Adapter 创建的 `ExamSession` 和不透明 `examId`。
- `watchExam()` 立即查询一次状态，后续使用默认 500ms、可配置的递归 `setTimeout` 查询；只有上一次异步查询完成后才安排下一次，避免重入。
- 对同一 `examId` 的多个观察者共享一个 watcher、一个 timer 和一个在途 Promise；重复注册同一观察者采用引用计数。
- 只在阶段、进度或消息变化时发布状态；较晚订阅者可立即收到 watcher 缓存的最近标准状态。
- 在 `completed`、`cancelled`、`error` 后清理 watcher；状态查询拒绝时调用必填 `onError` 并停止，不伪造 Adapter 状态。
- 主动取消时暂停轮询并失效化旧响应，取消成功后从 Adapter 读取并发布真实 `cancelled` 快照；取消失败时恢复 watcher 并抛出原错误。
- cleanup 和 `dispose()` 清理定时器并让在途旧响应失效，但不把仍在设备执行的检测解释为已取消。
- `getExamResult(examId)` 只委托 Adapter，不缓存、生成或补齐任何验光数据。
- 新增 10 个 ExamService 单元测试，并同步架构、设备接入、API Contract、技术决策和测试计划文档。

### 我做出的决策

- 继续复用领域层现有七个 `ExamStage`，不添加页面级 `idle`、`connecting` 或 `ready`，避免混淆设备、检测和未来 UI 状态。
- 使用递归 `setTimeout` 而不是 `setInterval`，让轮询间隔从上一请求完成后开始计算，天然避免慢请求并发。
- Adapter 返回的 `stage: error` 通过 `onStatus` 发布；`getExamStatus()` Promise 拒绝通过 `onError` 上报，两种错误语义不混合。
- 终态不会自动读取结果；未来页面收到 `completed` 后按自身生命周期显式调用 `getExamResult(examId)`。
- cleanup 只管理本地订阅生命周期，设备取消必须显式调用 `cancelExam(examId)`。
- 本阶段不增加整体检测超时、自动重试或 RxJS；这些能力应在有明确需求后独立设计。

### Codex 辅助内容

- 完整阅读项目规划、代理约束、架构、设备接入说明、API Contract 和既有开发日志。
- 复核现有领域类型、`DeviceAdapter`、`MockDeviceAdapter`、测试配置和文档术语。
- 实现 ExamService、测试和文档，并审查取消、cleanup、重复订阅、终态和在途 Promise 竞态。
- 执行代码检查、类型检查、完整测试和生产构建。

### 我人工检查/修改的内容

尚未记录，等待项目负责人检查。

### 测试结果

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test`：通过；3 个测试文件、26 个测试全部通过，其中 ExamService 新增 10 个测试。
- `npm run build`：通过；Vite 完成 76 个模块转换。
- ExamService 定向测试：通过；1 个测试文件、10 个测试全部通过。
- Vitest 和 Vite build 首次在受限沙箱内因子进程 `spawn EPERM` 无法启动；获准在沙箱外重跑后均通过，该限制与代码或断言失败无关。

### 未解决问题

- ExamService 尚未装配到首页或任何 React 页面；本次没有创建检测页、结果页或报告页。
- 当前未实现整体检测超时和自动重试策略，后续应按明确页面需求单独设计。
- 真实硬件、厂家 API、SDK、DLL、协议、厂家错误码和 17 项正式字段映射仍为 `TBD`。

### 下一步

后续阶段可实现检测页，在装配位置向 ExamService 注入 `MockDeviceAdapter`，并在 React effect cleanup 中调用 `watchExam()` 返回的清理函数。页面不直接调用 Adapter，也不创建轮询 timer。结果页和报告页继续等待各自阶段授权。

## 2026-08-28 — MockDeviceAdapter 模拟设备实现

### 本次目标

在不修改现有 `DeviceAdapter` 总体架构的前提下，实现一台完整遵守 contract 的纯内存 Mock Device，并覆盖连接、单检测并发、按时间推进、取消、结果、17 项中性扩展指标和 `rawData`。

### 完成内容

- 新增 `MockDeviceAdapter implements DeviceAdapter`，提供连接、断开、设备快照、启动、取消、检测状态和完成结果。
- 返回明确的 `MOCK-OPT-001` / `Smart Optometry Mock Device` 信息，所有状态与结果均标记 Mock/Demo，不包含真实厂家或型号。
- 集中定义普通 Demo 与快速测试时间配置；默认检测按 1 秒准备、2 秒左眼、2 秒右眼、1 秒分析推进。
- 用内存 Map 保存会话和终止状态，用 `activeExamId` 保证单设备只有一个活动检测。
- 按查询时已耗时间推导 `preparing → left_eye → right_eye → analyzing → completed`，不创建阶段定时器或 Adapter 内轮询。
- 实现取消及现有 5 个业务错误码；补充连接中断开时的竞态保护，旧连接请求不能覆盖 `disconnected`。
- 生成指定 OD/OS Demo 数值、17 项 `metric_01`～`metric_17` 中性占位数据，以及明确标记 `source: mock` 的 `rawData`。
- 新增 14 个 Mock 单元测试，并同步架构、设备接入与 API Contract 文档。

### 我做出的决策

- 现有 contract 没有类型错误，不修改 `DeviceAdapter`、领域类型或错误码集合。
- `ready` 不属于当前 `DeviceStatus` 枚举；连接就绪继续使用契约规定的 `connected + idle`，并用 Mock/Demo 状态消息明确“已连接并就绪”。
- `startExam()` 在返回 Promise 前同步完成检查、保存会话和占用设备，避免连续或并发调用创建第二个检测。
- `completedAt` 固定为 `startedAt + 总配置时长`，不依赖第一次查询完成状态的时刻。
- 检测中断开连接时将当前 Mock 会话安全终止为 `error`；这是 Demo 行为，不代表厂家设备规范。
- 普通 UI 只应读取标准 `ExamResult` 字段，不得依赖 `rawData` 内部结构。

### Codex 辅助内容

- 完整复核项目规划、代理约束、架构、设备接入说明和 API Contract。
- 实现 Mock、测试、统一导出和文档，并独立复查时间边界与连接/断开竞态。
- 执行类型检查、代码检查、完整单元测试和生产构建。

### 我人工检查/修改的内容

尚未记录，等待项目负责人检查。

### 测试结果

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm test`：通过；2 个测试文件、16 个测试全部通过，其中 MockDeviceAdapter 14 个测试。
- `npm run build`：通过；Vite 完成 76 个模块转换。
- Vitest 定向测试和首次生产构建在沙箱内曾因 Vite 子进程 `spawn EPERM` 无法启动；在获准的沙箱外环境重跑后均通过，该错误与代码或断言失败无关。

### 未解决问题

- Mock 尚未通过 Exam Service 接入 UI；本次未创建检测页、结果页、报告页或 Exam Service。
- 真实硬件尚未接入，厂家 API、SDK、DLL、协议、设备错误码和 17 项正式字段映射仍为 `TBD`。

### 下一步

后续阶段可实现依赖 `DeviceAdapter` 抽象的 Exam Service，并由装配位置注入 `MockDeviceAdapter`。取得厂家正式资料后，新增 `RealDeviceAdapter` 实现同一契约，再在同一装配位置替换具体实现，UI 无需依赖具体 Adapter。

## 2026-08-28 — DeviceAdapter 行为契约补充

### 本次目标

保持现有 `DeviceAdapter` 架构和方法签名不变，补充状态职责、单设备单检测、结果读取、取消、轮询、时间格式、`rawData` 用途和统一业务错误约束。

### 完成内容

- 新增简单的 `DeviceAdapterError` 和 5 个稳定业务错误码。
- 为现有接口补充单次状态快照、唯一活动检测、取消终态和完成后取结果的必要注释。
- 明确 `DeviceStatus` 只描述设备连接及整体空闲、忙碌、错误状态，`ExamStatus` 只描述单次检测阶段。
- 明确全部时间字段继续使用 ISO 8601 `string`，`rawData` 继续使用 `unknown`。
- 更新架构、API Contract、设备接入说明、技术决策和测试计划。

### 我做出的决策

- 不修改 `DeviceAdapter` 的 7 个方法、参数或返回类型，只增加可导出的业务错误类型。
- 一台设备只能有一个活动检测；重复启动使用 `DEVICE_BUSY`，不创建第二个会话。
- 只有 `completed` 检测可以返回结果，其他阶段使用 `EXAM_NOT_COMPLETED`。
- 取消只适用于进行中检测，成功后状态为 `cancelled`；终止阶段使用 `EXAM_ALREADY_FINISHED`。
- `getExamStatus()` 只返回一次快照；轮询由未来 Exam Service 负责，React 页面和 Adapter 不创建无限轮询。
- 错误码属于我方业务契约，不映射或猜测厂家私有错误码。

### Codex 辅助内容

- 复核当前 contract、项目规划和未提交改动。
- 补充错误类型、接口注释和相关文档，没有实现 Mock、Exam Service、页面或真实设备通讯。
- 执行项目现有类型检查、代码检查、测试和生产构建。

### 我人工检查/修改的内容

尚未记录，等待项目负责人检查。

### 测试结果

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm test`：通过；1 个测试文件、2 个测试全部通过。
- `npm run build`：通过；Vite 完成 76 个模块转换。

### 未解决问题

- `MockDeviceAdapter` 与 Exam Service 尚未实现，因此并发、取消、结果和轮询规则目前是 contract 与文档约束，没有运行时行为。
- 厂家接口、真实错误码和正式字段映射仍为 `TBD`。

### 下一步

未来实现 `MockDeviceAdapter` 时，用共享契约测试验证本阶段定义的业务规则；未获授权前不接入 UI 或真实设备。

## 2026-08-28 — DeviceAdapter 设备抽象契约

### 本次目标

只建立与厂家设备解耦的 `DeviceAdapter` 接口和标准 TypeScript 类型，不实现 Mock、真实设备通讯、检测页或结果页。

### 完成内容

- 新增 `DeviceAdapter` 的连接、断开、设备状态、启动检测、取消检测、检测状态和结果读取接口。
- 新增 `DeviceInfo`、`DeviceStatus`、`ExamSession`、`ExamStatus`、`ExamResult`、`EyeRefraction`、`ExtendedMetric` 等领域类型。
- 将设备、检测和结果类型分别放入 `src/domain/`，由统一入口导出，避免未来页面与 Adapter 重复定义。
- 扩展指标使用 `metrics` 集合，不创建 17 个固定业务字段。
- 将 `ExamResult.rawData` 设为必填 `unknown`，要求调用方缩窄类型后才能访问。
- 明确单次检测的 `ExamStatus` 与未来 Exam Service 完整 UI 状态机的边界。
- 新建内部 API Contract，并同步架构、设备接入、产品范围、技术决策、测试计划和 README 状态。

### 我做出的决策

- 把设备连接状态与运行状态拆开，允许表达“已连接但忙碌”等组合状态，而不是使用单一布尔值。
- `DeviceAdapter` 保持纯异步接口，以兼容后续 Mock 延迟、本地桥接或正式厂家接口。
- 厂家、型号、序列号和固件版本作为 `DeviceInfo` 可选字段；没有正式资料时不填值。
- `examId` 使用不透明字符串，上层不解析其生成规则。
- 未知 17 项仍只允许使用 `metric_01`～`metric_17` 及中性显示名；当前没有生成任何指标值、医学名称或单位。
- 本阶段不定义厂家错误码或真实通信行为，操作失败由 Promise 显式拒绝，统一应用错误类型留待 Exam Service 与 Mock 阶段结合实际场景补充。

### Codex 辅助内容

- 完整阅读项目规划、代理约束、产品范围和原架构文档。
- 盘点现有源码，确认此前没有可复用的设备领域类型。
- 实现设备抽象契约、领域类型和配套文档，并执行项目验证命令。

### 我人工检查/修改的内容

尚未记录，等待项目负责人检查。

### 测试结果

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm test`：通过；1 个测试文件、2 个测试全部通过。首次在沙箱内运行因 Vite 子进程 `spawn EPERM` 启动失败，在获准的沙箱外环境重跑后通过。
- `npm run build`：通过；Vite 完成 76 个模块转换。首次在沙箱内运行同样因 `spawn EPERM` 失败，在获准的沙箱外环境重跑后通过。
- 本阶段只新增类型与接口，没有具体 Adapter 行为，因此未伪造连接、取消或结果单元测试；现有首页回归测试保持通过。

### 未解决问题

- `MockDeviceAdapter` 尚未实现。
- Exam Service、完整状态机和设备错误模型尚未实现。
- UI 尚未接入 DeviceAdapter，检测页、结果页和报告页尚未实现。
- 厂家接口、接入方式、错误码及 17 项正式字段定义仍为 `TBD`。

### 下一步

等待用户明确授权后，再基于当前契约实现 `MockDeviceAdapter` 及其契约测试，不提前接入 UI 或真实设备。

## 2026-08-28 — Phase 1 智能验光 Demo 首页

### 本次目标

只实现智能验光 Demo 首页，不实现检测流程、结果页、报告页或设备适配器。

### 完成内容

- 重建当前分支缺失的 React、TypeScript、Vite、Router、ESLint 与测试基础文件。
- 实现医疗科技风的响应式 Demo 首页。
- 添加设备状态卡、DEMO MODE、设备编号、连接状态和最后通信时间。
- 添加“开始智能验光”按钮；因设备未接入，按钮保持不可用且不触发检测。
- 保留“连接设备”入口；点击只反馈当前阶段不可用，不模拟连接成功。
- 清理 `README.md` 中已提交的 Git 冲突标记。

### 我做出的决策

- 首页使用 `OPT-DEMO-001` 作为明确的 Demo 设备编号，不代表真实设备。
- 在没有 Mock Device 和厂家接口的阶段，连接状态显示“设备未接入”，最后通信时间显示“暂无通信”。
- 不为开始按钮创建空路由或伪检测逻辑。

### Codex 辅助内容

- 阅读并遵守 `PROJECT_PLAN.md` 与 `AGENTS.md`。
- 实现首页组件、样式、测试和相关文档更新。

### 我人工检查/修改的内容

尚未记录，等待项目负责人检查。

### 测试结果

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm run build`：通过；Vite 完成 76 个模块转换。
- `npm test`：通过；1 个测试文件、2 个测试全部通过。
- 本地浏览器渲染检查：通过；桌面布局、连接提示和禁用状态符合本阶段范围。
- 浏览器控制台：无错误或警告。
- npm 离线锁文件校验：0 个漏洞。

### 未解决问题

- Mock Device、连接状态推进与检测流程尚未实现。
- 结果页和报告页尚未实现。
- 厂家接口及 17 项正式字段定义仍为 `TBD`。

### 下一步

等待用户明确授权后再进入下一个开发阶段。
