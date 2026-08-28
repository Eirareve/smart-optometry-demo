# 设备接入说明

## 当前状态

- 当前产品阶段：网页 Demo。
- 当前代码状态：已实现遵守统一契约的 `MockDeviceAdapter`、与正式契约分离的 Mock 故障控制/诊断接口和注入式 `ExamService`；首页、检测页、结果页与报告页已通过应用级共享依赖接入正式流程。
- 真实设备：未接入。
- 厂家接口资料：尚未取得。
- 17 项正式字段定义：尚未取得。

在正式资料到位前，不得编写或声称存在厂家 API、SDK、DLL、协议、错误码或医学字段映射。

## 当前 DeviceAdapter 契约

我方内部统一接口位于 `src/services/device/DeviceAdapter.ts`，业务错误位于 `src/services/device/DeviceAdapterError.ts`，领域类型位于 `src/domain/`。当前契约覆盖连接、断开、设备状态、启动检测、取消检测、检测状态和结果读取。详细方法、单检测并发规则、轮询责任与错误码见 `docs/04-api-contract.md`。

该契约是当前 Mock 与未来 Real Adapter 共同遵循的我方标准，不是厂家 API。`MockDeviceAdapter` 已实现该契约，`ExamService` 只依赖该接口并负责轮询、取消和清理；首页只调用 `ExamService.connect()` 和 `getDeviceStatus()`，不直接访问具体 Adapter。`simulateFailure()`、`setScenario()`、`forceDisconnect()`、`resetDemo()`、`getDiagnosticLog()` 等 Demo 方法没有进入 `DeviceAdapter`。

## V0.1 Mock Device 实现

```text
当前页面：HomePage / ExamPage / ResultPage / ReportPage → ExamService → DeviceAdapter → MockDeviceAdapter

当前测试：HomePage / ExamPage / ResultPage / ReportPage / ExamService → DeviceAdapter → MockDeviceAdapter
```

实现位于 `src/services/device/MockDeviceAdapter.ts`，测试位于 `src/services/device/MockDeviceAdapter.test.ts`。该类是纯内存 Demo 实现，不调用厂家 SDK、API、DLL、通信协议或真实硬件，也不代表真实设备能力。

连接成功返回：

```text
设备名称：Smart Optometry Mock Device
设备 ID：MOCK-OPT-001
```

名称、编号和状态消息均明确包含 Mock/Demo 含义，不填写未经确认的厂家、真实型号、序列号或固件版本。当前 `DeviceStatus` 没有 `ready` 枚举；Mock 就绪按既有契约表达为 `connectionState: connected`、`operatingState: idle`，同时由 `message` 明确说明“Mock/Demo 设备已连接并就绪”。断开后为 `disconnected` 和 `unknown`。

### 应用装配与页面状态

`src/app/dependencies.ts` 在模块首次加载时创建唯一的 `MockDeviceAdapter`，立即注入唯一的 `ExamService`。`AppDependenciesProvider` 位于 Router 外层，并通过 Context 向当前和未来页面提供该服务。路由切换不会重新加载依赖模块或重建 Provider，因此 Mock 的内存连接状态、活动检测与历史 `examId` 不会因页面组件切换而丢失。

首页挂载时通过 `ExamService.getDeviceStatus()` 读取标准快照；如果共享设备此前已连接，则通过幂等 `connect()` 重新取得 `DeviceInfo` 后刷新状态。点击“连接设备”时先呈现 `connecting`，再调用 `ExamService.connect()`，成功后读取新状态、DeviceInfo 和最后通信时间，失败则保留可重试入口并显示 `role="alert"` 错误。页面不创建 Adapter，也没有引入 Redux。

### 使用与时间配置

Mock 可通过设备服务统一导出入口创建：

```ts
import {
  FAST_MOCK_DEVICE_TIMING,
  MockDeviceAdapter,
} from '../src/services/device'

const demoAdapter = new MockDeviceAdapter()
const fastAdapter = new MockDeviceAdapter({
  timing: FAST_MOCK_DEVICE_TIMING,
})
```

`DEFAULT_MOCK_DEVICE_TIMING` 集中保存普通 Demo 时间：连接延迟 350ms，随后依次为 1 秒准备、2 秒左眼模拟采集、2 秒右眼模拟采集、1 秒模拟分析，总检测时长 6 秒。`FAST_MOCK_DEVICE_TIMING` 为测试或快速演示提供每阶段 10ms、连接 0ms 的配置，也可通过构造参数覆盖单项时间。

连接只使用一个延迟辅助函数。检测阶段不创建多个 `setTimeout`，也不在 Adapter 内轮询；每次 `getExamStatus(examId)` 都根据 `Date.now() - startedAtMs` 和集中阈值计算当前快照：

```text
preparing (10%)
  → left_eye (35%)
  → right_eye (65%)
  → analyzing (90%)
  → completed (100%)
```

### Mock 故障控制

Mock 专用控制接口位于 `src/services/device/MockDeviceControl.ts`：

```ts
type MockDeviceScenario =
  | 'normal'
  | 'connect_failure'
  | 'start_exam_failure'
  | 'exam_error'
  | 'status_query_failure'

interface MockDeviceControl {
  getScenario(): MockDeviceScenario
  setScenario(scenario: MockDeviceScenario): void
  reset(): void
}
```

`MockDeviceAdapter` 同时实现 `DeviceAdapter` 与 `MockDeviceControl`，但 `MockDeviceControl` 不属于厂家无关的正式契约，未来 `RealDeviceAdapter` 无需实现。当前业务装配仍只以 `DeviceAdapter` 类型把 Mock 注入 `ExamService`，React 页面没有获得 Mock 控制引用；本阶段未创建 Developer 页面。

场景均为确定性行为，不使用随机故障：

| 场景 | 行为 |
|---|---|
| `normal` | 保持原连接、检测推进、取消和结果行为 |
| `connect_failure` | 未连接设备执行 `connect()` 时以 `DEVICE_CONNECTION_FAILED` 拒绝，连接状态进入 `error`，不会误报 `connected` |
| `start_exam_failure` | 已连接且空闲时执行 `startExam()` 以 `EXAM_START_FAILED` 拒绝，不创建 `ExamSession` 或 `examId`，设备保持 `connected + idle` |
| `exam_error` | `startExam()` 正常创建 `examId`；准备和左眼阶段后，在进入右眼采集阶段时转为标准 `ExamStatus.stage = error`，释放设备且结果读取继续以 `EXAM_NOT_COMPLETED` 拒绝 |
| `status_query_failure` | `getExamStatus(examId)` 以 `DEVICE_COMMUNICATION_ERROR` 拒绝，用于触发 `ExamService` observer 的 `onError`；不会伪造 `ExamStatus.error` |

`reset()` 将场景恢复为 `normal`；如果连接故障留下 `error` 或存在未完成的连接尝试，还会使其恢复为干净的 `disconnected` 状态并失效化旧连接请求。已完成、已取消或已进入 `error` 的历史检测不会被改写为成功结果。诊断事件由独立的 `clearDiagnosticEvents()` 清理，避免重置场景时丢失故障证据。

新增的 `DEVICE_CONNECTION_FAILED`、`EXAM_START_FAILED` 和 `DEVICE_COMMUNICATION_ERROR` 是我方 Demo / Adapter 层安全错误码，不是厂家真实错误码，也不暗示任何厂家协议或 SDK 行为。

### Mock 诊断事件

`src/services/device/MockDeviceDiagnostics.ts` 定义独立的 `MockDeviceDiagnostics`：

```ts
interface MockDeviceDiagnostics {
  getDiagnosticEvents(): readonly MockDiagnosticEvent[]
  clearDiagnosticEvents(): void
}
```

每条事件至少包含 ISO 8601 `timestamp`、`type` 和安全 `message`；检测相关事件可增加 `examId` 与标准 `stage`。当前覆盖连接请求/成功/失败、检测启动请求/成功/失败、阶段变化、取消、检测失败、状态查询失败、设备断开和控制重置。事件只保存在 `MockDeviceAdapter` 实例的内存数组中，读取时返回副本；默认上限为最近 100 条，超过上限时从最早事件开始删除。该日志只用于 Demo / developer diagnostics，不属于 `DeviceAdapter`，不代表厂家原始通信日志，不写入 `rawData`，也不包含患者信息。

### 内存状态与并发

- `Map<examId, MockExamRecord>` 保存检测会话、毫秒时间戳及可选终止状态。
- `activeExamId` 只指向当前进行中的检测；开始时先同步占用，再返回 `ExamSession`，避免重复 `startExam()` 创建第二个会话。
- 到达 `completed`、成功取消或进入 `error` 后释放活动检测名额。
- 检测过程中断开 Mock 连接时，该会话结束为 `error`；这只是当前 Mock 的安全终止行为，不代表厂家设备规范。
- 所有标准时间字段对外转换为 ISO 8601 字符串。

Mock 遵守“一台设备只有一个活动检测”的契约，并覆盖 `DEVICE_NOT_CONNECTED`、`DEVICE_BUSY`、`DEVICE_CONNECTION_FAILED`、`EXAM_START_FAILED`、`DEVICE_COMMUNICATION_ERROR`、`EXAM_NOT_FOUND`、`EXAM_NOT_COMPLETED` 和 `EXAM_ALREADY_FINISHED`。这些是我方业务或 Demo/Adapter 层错误码，不是厂家错误码。

### 模拟结果

Mock 数据规则：

- 必须标记来源为 `mock` 或“模拟数据”。
- 右眼固定 Demo 值为 SPH -2.50、CYL -0.75、AXIS 175；左眼为 SPH -2.75、CYL -0.50、AXIS 10。
- 未知 17 项的 code 仅使用 `metric_01`～`metric_17`。
- 未知 17 项的显示名仅使用“扩展检测指标 01”～“扩展检测指标 17”。
- 占位值仅使用 `DEMO-01`～`DEMO-17`，状态为 `unknown`。
- 不赋予未知项医学名称、医学单位、合法范围或诊断状态。
- `ExamResult.source` 固定为 `mock`。
- 原始模拟返回保留在 `rawData`，其内部同样包含 `source: mock` 和 `demo: true`，只用于调试与未来映射验证；普通 UI 不得依赖其内部结构。

检测完成后，ExamPage 只把 Adapter 返回的不透明 `examId` 传入 `/results/:examId`，ResultPage 再把同一标识传入 `/report/:examId`。ResultPage 与 ReportPage 都通过共享 `ExamService.getExamResult(examId)` 读取标准结果，并直接遍历 `ExamResult.metrics`；页面不访问 `MockDeviceAdapter`，也不读取 `rawData`。Mock 内存记录不存在或检测尚未完成时，Adapter 按既有契约拒绝读取，两个页面均显示明确错误而不是生成替代数据。报告打印只是浏览器 UI 行为，不改变 DeviceAdapter 契约或 Mock 数据结构。

## 获取厂家资料后的接入步骤

1. 在 `docs/vendor/` 保存允许入库的协议版本信息。
2. 核验接入方式、运行环境、驱动和依赖。
3. 获取一份完整、脱敏的真实原始返回样例。
4. 建立并评审厂家字段到我方模型的映射表。
5. 先验证连接，再验证启动、状态、取消和结果获取。
6. 根据正式接入方式实现 Real Device Adapter；需要时建立 Local Device Bridge。
7. 保留原始数据和通信日志，并明确错误与重试策略。
8. 让 Mock 与 Real 实现遵循同一套契约测试。
9. 完成独立验证后，才允许正式 UI 切换到真实设备。

## 待索取资料清单

### 厂家与版本

- 厂家：`TBD`
- 设备型号：`TBD`
- 固件版本：`TBD`
- 协议版本：`TBD`

### 接入与运行环境

- 接入方式：`TBD`
- SDK/DLL 名称与版本：`TBD`
- 操作系统及 x64/x86 要求：`TBD`
- 驱动及 Runtime 依赖：`TBD`
- 端口、权限和并发限制：`TBD`
- 是否要求厂家软件同时运行：`TBD`

### 设备能力

- 连接与断开流程：`TBD`
- 设备信息与状态查询：`TBD`
- 启动与取消检测：`TBD`
- 进度查询或事件回调：`TBD`
- 结果获取：`TBD`
- 超时、重连和设备忙处理：`TBD`

### 数据协议

- 完整字段名和 code：`TBD`
- 数据类型与单位：`TBD`
- 左右眼标识：`TBD`
- 合法范围与空值规则：`TBD`
- 异常值与状态码：`TBD`
- 完整原始返回样例：`TBD`
- 17 项正式字段映射：`TBD`
- 错误码：`TBD`

## 厂家设备接口接入记录

### 厂家

`TBD`

### 型号

`TBD`

### 协议版本

`TBD`

### 接入方式

`TBD`

### SDK/DLL

`TBD`

### 连接流程

`TBD`

### 启动检测

`TBD`

### 状态查询

`TBD`

### 数据返回

`TBD`

### 17 项字段映射

`TBD`

### 错误码

`TBD`

### 原始示例

`TBD`

### 已知限制

`TBD`
