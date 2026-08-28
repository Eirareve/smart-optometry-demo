# ExamService 与 DeviceAdapter API Contract

## 范围与状态

本文记录网页 Demo 内部的 TypeScript 流程服务与设备契约。`ExamService` 位于 React UI 和 `DeviceAdapter` 之间；`DeviceAdapter` 用于统一当前 `MockDeviceAdapter` 和未来 `RealDeviceAdapter` 对上层提供的能力。本文**不是厂家设备接口文档**，不代表任何厂家已经支持这些方法。

当前已完成领域类型、`DeviceAdapter`、`MockDeviceAdapter` 内存实现和注入式 `ExamService`；首页与 `/exam/:examId` 检测页均通过应用级共享依赖使用同一 ExamService。真实设备通讯、HTTP API、本地设备桥接服务、结果页和报告页均未实现。

## 代码位置

```text
src/domain/device.ts
src/domain/exam.ts
src/domain/result.ts
src/domain/index.ts
src/services/device/DeviceAdapter.ts
src/services/device/DeviceAdapterError.ts
src/services/device/MockDeviceAdapter.ts
src/services/device/MockDeviceAdapter.test.ts
src/services/device/index.ts
src/services/exam/ExamService.ts
src/services/exam/ExamService.test.ts
src/services/exam/index.ts
src/app/dependencies.ts
src/app/AppDependenciesProvider.tsx
src/app/router.tsx
src/pages/HomePage.tsx
src/pages/ExamPage.tsx
src/app/HomePage.test.tsx
src/app/ExamPage.test.tsx
```

## DeviceAdapter 接口

```ts
export interface DeviceAdapter {
  connect(): Promise<DeviceInfo>
  disconnect(): Promise<void>
  getStatus(): Promise<DeviceStatus>
  startExam(): Promise<ExamSession>
  cancelExam(examId: string): Promise<void>
  getExamStatus(examId: string): Promise<ExamStatus>
  getExamResult(examId: string): Promise<ExamResult>
}
```

所有方法均为异步接口，以兼容 Mock 延迟、未来本地桥接服务或厂家正式接口。`examId` 是 Adapter 返回的不透明标识；调用方只负责原样传递，不依赖其格式。

## ExamService 接口

```ts
export interface ExamServiceOptions {
  readonly pollIntervalMs?: number
}

export interface ExamObserver {
  readonly onStatus: (status: ExamStatus) => void
  readonly onError: (error: unknown) => void
}

export class ExamService {
  constructor(adapter: DeviceAdapter, options?: ExamServiceOptions)

  connect(): Promise<DeviceInfo>
  disconnect(): Promise<void>
  getDeviceStatus(): Promise<DeviceStatus>

  startExam(): Promise<ExamSession>
  watchExam(examId: string, observer: ExamObserver): () => void
  cancelExam(examId: string): Promise<void>
  getExamResult(examId: string): Promise<ExamResult>

  dispose(): void
}
```

构造函数必须由应用装配位置传入 `DeviceAdapter`。ExamService 不导入、创建或判断 `MockDeviceAdapter` / 未来 `RealDeviceAdapter`，因此更换设备实现不会改变服务 API。默认轮询间隔为 `500ms`；测试或装配位置可以传入正有限数覆盖，`0`、负数、`NaN` 和无穷值会被拒绝。

### 连接、启动和结果

| 方法 | 行为 |
|---|---|
| `connect()` | 委托 `DeviceAdapter.connect()` 并返回标准 `DeviceInfo` |
| `disconnect()` | 先清理全部 watcher，再委托 `DeviceAdapter.disconnect()` |
| `getDeviceStatus()` | 委托 `DeviceAdapter.getStatus()` 返回单次设备快照 |
| `startExam()` | 委托 `DeviceAdapter.startExam()`，原样返回含不透明 `examId` 的 `ExamSession` |
| `getExamResult(examId)` | 只委托 `DeviceAdapter.getExamResult(examId)`，不缓存、补齐或生成结果 |

ExamService 不在 `completed` 时自动获取结果。页面后续收到完成状态后，可按页面生命周期显式调用 `getExamResult(examId)`；结果是否可读仍遵守 Adapter 的 `completed` 前置条件。

### watchExam 与轮询

`watchExam(examId, observer)` 注册状态观察者并立即发起第一次 `getExamStatus(examId)`。后续使用递归 `setTimeout`：只有上一次 Promise 已经完成，才等待轮询间隔并发起下一次查询，因此不会出现同一 watcher 的异步查询重入。

服务只在阶段、进度或消息发生变化时调用 `observer.onStatus(status)`，不因 `updatedAt` 单独变化而重复发布相同业务状态。较晚加入同一活动 watcher 的新观察者会立即收到已缓存的最近一次标准状态。

同一 `examId` 只创建一个 watcher：

- 多个不同观察者共享同一计时器和同一个在途查询。
- 同一观察者重复注册时使用引用计数，不重复发送相同回调，也不会创建新轮询。
- 每次调用都返回幂等 cleanup；cleanup 只释放本次注册。
- 最后一个观察者离开后，清除待执行定时器并删除 watcher。
- generation 和 Map identity 会让 cleanup、取消或终态之后返回的旧 Promise 失效；旧响应不能再通知页面或重启定时器。

以下为轮询停止条件：

```text
completed | cancelled | error
```

Adapter 返回这些终态时，ExamService 先关闭 watcher，再向当时的观察者发布最后一份标准 `ExamStatus`。状态查询 Promise 拒绝时，不伪造 Adapter 状态；服务关闭 watcher，并把原始错误交给每个观察者的 `onError(error)`。二者语义不同：Adapter 返回的 `stage: error` 属于标准检测终态，通信或查询拒绝属于观察错误。

### 主动取消与 cleanup

`cancelExam(examId)` 是设备业务操作，cleanup 是本地订阅操作，两者不能互换：

- 主动取消先暂停 watcher、清除待执行 timer，并失效化旧查询响应。
- 然后调用 `DeviceAdapter.cancelExam(examId)`。
- 取消成功且仍有观察者时，等待旧在途查询结束，再读取一次 Adapter 最新快照并发布 `cancelled`；不会合成取消状态。
- 取消失败时恢复原 watcher，并向 `cancelExam()` 调用方抛出原错误。
- cleanup 或 `dispose()` 只停止观察，不调用 Adapter 取消，也不把仍在设备执行的检测标记为 `cancelled`。

## 当前 Mock 实现

`MockDeviceAdapter implements DeviceAdapter`，没有修改上述 7 个方法或领域类型。它是明确标记的纯内存 Demo 数据源，不包含真实厂家名称、型号、接口、协议或硬件能力声明。

### 连接与设备状态

- 初始状态为 `connectionState: disconnected`、`operatingState: unknown`。
- `connect()` 使用集中配置的短暂延迟，返回 `MOCK-OPT-001` / `Smart Optometry Mock Device`。
- 连接成功后按当前契约返回 `connectionState: connected`、`operatingState: idle`，并在 `message` 中明确设备为 Mock/Demo 且已就绪。
- `ready` 不是 `DeviceStatus` 的枚举值；它属于未来 UI 接入时组合的页面流程状态，因此当前 ExamService 没有扩展或修改 contract。
- 活动检测期间 `operatingState` 为 `busy` 并携带 `activeExamId`；终止后恢复 `idle`。
- `disconnect()` 后为 `disconnected`；若断开时存在活动检测，Mock 将该检测安全终止为 `error`。该行为只属于 Demo，不表示真实设备规范。

### 时间与会话保存

普通 Demo 的集中配置为：

```ts
const DEFAULT_MOCK_DEVICE_TIMING = {
  connectDelayMs: 350,
  preparingMs: 1000,
  leftEyeMs: 2000,
  rightEyeMs: 2000,
  analyzingMs: 1000,
}
```

测试可注入 `FAST_MOCK_DEVICE_TIMING` 或覆盖任一时间项。Mock 用内存 `Map` 按 `examId` 保存 `ExamSession`、内部毫秒时间戳和可选终止状态，并单独保存 `activeExamId`。阶段由查询时的已耗时间与累计阈值推导，不使用后台阶段定时器，也不承担轮询。

`startExam()` 在返回 Promise 前完成连接检查、活动检测检查、会话保存和设备占用。因此同一实例的并发或连续重复调用不能越过 `DEVICE_BUSY` 检查。到达总时长后，即使此前没有查询状态，下一次状态、设备或启动请求也会先识别旧检测已经完成并释放名额。

### Mock 结果

只有推导状态为 `completed` 时才构造标准 `ExamResult`：

- `source` 固定为 `mock`。
- OD：SPH -2.50、CYL -0.75、AXIS 175。
- OS：SPH -2.75、CYL -0.50、AXIS 10。
- `metrics` 恰好包含 `metric_01`～`metric_17` 和“扩展检测指标 01”～“扩展检测指标 17”，占位值为 `DEMO-01`～`DEMO-17`，不包含医学单位或未经确认的医学含义。
- `rawData` 必填，包含明确的 `source: mock`、`demo: true` 以及 Mock 内部原始结构。它不属于 UI 数据契约，页面不得依赖其结构。

## 方法语义

| 方法 | 输入 | 成功结果 | 约束 |
|---|---|---|---|
| `connect` | 无 | 标准化 `DeviceInfo` | 建立当前 Adapter 所代表的数据源连接；不暴露厂家连接细节 |
| `disconnect` | 无 | `void` | 释放当前 Adapter 持有的连接资源 |
| `getStatus` | 无 | `DeviceStatus` | 只返回调用时刻的一次设备快照，不启动持续轮询 |
| `startExam` | 无 | `ExamSession` | 一台设备只允许一个活动检测；未连接或设备忙时显式拒绝 |
| `cancelExam` | `examId` | `void` | 只取消进行中的检测；成功后状态必须进入 `cancelled` |
| `getExamStatus` | `examId` | `ExamStatus` | 只返回调用时刻的一次检测状态快照，不启动持续轮询 |
| `getExamResult` | `examId` | `ExamResult` | 仅在检测为 `completed` 时返回结果，并必须保留 `rawData` |

操作失败时 Promise 应拒绝，Adapter 不得静默吞掉错误。可观察的设备或检测异常同时通过 `DeviceStatus` / `ExamStatus` 的 `error` 状态表达。

## 业务不变量

### 状态职责

- `DeviceStatus` 表示设备整体状态：是否连接，以及处于 `unknown`、`idle`、`busy` 或 `error`。它不表达左眼、右眼或分析等单次检测阶段。
- `ExamStatus` 只表示某个 `examId` 的检测阶段及可选进度。它不替代设备连接状态。

### 单检测并发

V0.1 假设一台设备同一时间只能有一个活动检测。活动阶段为：

```text
preparing | left_eye | right_eye | analyzing
```

存在上述任一阶段的检测时：

- `DeviceStatus.operatingState` 应为 `busy`。
- 再次调用 `startExam()` 必须以 `DEVICE_BUSY` 拒绝。
- 不创建第二个 `ExamSession`，也不允许多个并发检测。

没有活动检测且设备可用时，`DeviceStatus.operatingState` 为 `idle`。`completed`、`cancelled` 和 `error` 是终止阶段，不再占用活动检测名额。

### 结果读取

`getExamResult(examId)` 只有在对应 `ExamStatus.stage` 为 `completed` 时才能返回 `ExamResult`。规则如下：

- `examId` 不存在：抛出 `EXAM_NOT_FOUND`。
- 检测仍在执行、已取消或以错误结束：抛出 `EXAM_NOT_COMPLETED`。
- 不返回 `null`、空对象、部分结果或临时伪造结果。

### 取消

`cancelExam(examId)` 只适用于 `preparing`、`left_eye`、`right_eye` 或 `analyzing` 阶段：

- 取消成功后，后续 `getExamStatus(examId)` 必须返回 `cancelled`。
- `examId` 不存在时抛出 `EXAM_NOT_FOUND`。
- 检测已经进入 `completed`、`cancelled` 或 `error` 时抛出 `EXAM_ALREADY_FINISHED`。

### 轮询

`getExamStatus(examId)` 每次调用只读取并返回一份状态快照。它不在 `DeviceAdapter` 内部创建定时器或无限轮询。

持续查询的频率、终态停止、取消定时器、订阅 cleanup 和查询错误处理由 ExamService 负责。当前服务尚未增加整体检测超时策略；React 页面只消费 ExamService 提供的状态和错误，不直接实现轮询。

## 业务错误模型

`src/services/device/DeviceAdapterError.ts` 提供简单的 `DeviceAdapterError`，包含可供上层判断的 `code` 和可读 `message`：

```ts
type DeviceAdapterErrorCode =
  | 'DEVICE_NOT_CONNECTED'
  | 'DEVICE_BUSY'
  | 'EXAM_NOT_FOUND'
  | 'EXAM_NOT_COMPLETED'
  | 'EXAM_ALREADY_FINISHED'
```

| 错误码 | 使用场景 |
|---|---|
| `DEVICE_NOT_CONNECTED` | 操作要求设备已连接，但当前未连接；例如调用 `startExam()` |
| `DEVICE_BUSY` | 已有未结束的活动检测，又调用 `startExam()` |
| `EXAM_NOT_FOUND` | 指定 `examId` 不存在 |
| `EXAM_NOT_COMPLETED` | 在检测不是 `completed` 时调用 `getExamResult()` |
| `EXAM_ALREADY_FINISHED` | 对 `completed`、`cancelled` 或 `error` 检测调用 `cancelExam()` |

这些是我方稳定的业务错误码，不是厂家错误码。未来具体 Adapter 应把可识别的厂家失败映射到我方契约；无法安全映射的底层异常仍需显式抛出，不得编造厂家含义。

## 类型契约

### DeviceInfo

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 我方使用的设备标识 |
| `name` | `string` | 可显示的设备名称 |
| `manufacturer` | `string?` | 厂家资料确认后才填写 |
| `model` | `string?` | 设备型号，当前为 `TBD` |
| `serialNumber` | `string?` | 设备序列号，当前为 `TBD` |
| `firmwareVersion` | `string?` | 固件版本，当前为 `TBD` |

可选厂家字段的存在只为未来映射预留结构，不表示当前已取得对应数据。

### DeviceStatus

`DeviceStatus` 只描述设备层面的连接和整体运行状态，不描述单次检测的 `preparing`、`left_eye` 等阶段。

| 字段 | 类型 | 说明 |
|---|---|---|
| `connectionState` | `disconnected \| connecting \| connected \| disconnecting \| error` | 标准连接状态 |
| `operatingState` | `unknown \| idle \| busy \| error` | 标准运行状态 |
| `observedAt` | `string` | 状态采集时间，ISO 8601 |
| `lastCommunicationAt` | `string \| null` | 最近成功通信时间；尚无通信时为 `null` |
| `activeExamId` | `string?` | 能明确关联活动检测时提供 |
| `message` | `string?` | 面向上层的安全摘要，不承载原始协议报文 |

连接状态与运行状态分开建模，因此可以表达“已连接但忙碌”或“连接正常但设备运行异常”，无需把所有情况压缩成一个布尔值。

### ExamSession 与 ExamStatus

`ExamSession` 包含 `examId` 和 ISO 8601 格式的 `startedAt`，表示检测请求已被 Adapter 接受。

`ExamStatus` 包含：

- `examId`
- `stage`
- `progress`：`0`～`100`；数据源无法提供时为 `null`
- `updatedAt`：ISO 8601
- 可选 `message`

检测阶段仅包含：

```text
preparing | left_eye | right_eye | analyzing | completed | cancelled | error
```

这些只表示单次检测会话的阶段。设备是否连接、空闲、忙碌或异常由 `DeviceStatus` 表示；`idle`、`connecting` 和 `ready` 由未来 UI 接入时结合两类状态组织，不属于 `ExamStatus`。

### 时间字段

以下字段全部使用 ISO 8601 `string`，不使用 `Date` 对象或自定义日期格式：

- `DeviceStatus.observedAt`
- `DeviceStatus.lastCommunicationAt`；尚无成功通信时为 `null`
- `ExamSession.startedAt`
- `ExamStatus.updatedAt`
- `ExamResult.startedAt`
- `ExamResult.completedAt`

### EyeRefraction

只定义当前已知的数值字段：

```ts
interface EyeRefraction {
  sphere: number
  cylinder: number
  axis: number
}
```

它们分别承载页面所需的 SPH、CYL、AXIS。当前契约不添加诊断、处方结论或未经厂家资料确认的合法范围。

### ExtendedMetric

扩展指标使用数组元素而不是 17 个固定业务字段：

```ts
interface ExtendedMetric {
  code: string
  displayName: string
  value: string | number
  unit?: string
  status?: 'normal' | 'attention' | 'unknown'
}
```

V0.1 Mock 实现未来生成的未知 17 项必须遵守：

- `code` 仅为 `metric_01`～`metric_17`。
- `displayName` 仅为“扩展检测指标 01”～“扩展检测指标 17”。
- 不赋予医学名称、医学单位、范围或诊断含义。
- 未有正式依据时不填写 `unit`，`status` 只能省略或使用 `unknown`。

### ExamResult

| 字段 | 类型 | 说明 |
|---|---|---|
| `examId` | `string` | 对应检测标识 |
| `source` | `mock \| device` | 数据来源；Mock 必须使用 `mock` |
| `rightEye` | `EyeRefraction` | 右眼标准数据 |
| `leftEye` | `EyeRefraction` | 左眼标准数据 |
| `metrics` | `readonly ExtendedMetric[]` | 可扩展指标集合 |
| `rawData` | `unknown` | Adapter 转换前的完整原始返回 |
| `startedAt` | `string` | 检测开始时间，ISO 8601 |
| `completedAt` | `string` | 检测完成时间，ISO 8601 |

`rawData` 保持必填 `unknown`。它主要用于设备集成调试、受控日志和未来字段重新解析；读取前必须校验或缩窄类型。普通 UI 使用标准字段渲染，不直接依赖 `rawData` 的内部结构，也不能把它当作标准字段缺失时的页面回退数据源。

## 实现责任边界

### 具体 Adapter 负责

- 连接具体数据源。
- 将来源状态映射为 `DeviceStatus` 和 `ExamStatus`。
- 将来源结果映射为 `ExamResult`。
- 保留完整 `rawData`。
- 保证单设备只有一个活动检测。
- 按本契约抛出可识别的业务错误。
- 在操作失败或数据无法可靠映射时显式报错。

### Exam Service 负责

- 组合连接状态与检测状态机。
- 当前通过有限轮询组织调用时序，负责终态停止、重复监听共享、订阅 cleanup 和查询错误上报。
- 主动取消，并在成功后读取 Adapter 的真实终态快照。
- 未来需要时再增加整体检测超时和重试策略；本阶段不提前实现。
- 向 UI 提供与具体 Adapter 无关的应用状态。

### UI 负责

- 发出连接、开始、取消等用户意图。
- 呈现 Exam Service 提供的状态和标准结果。
- 对所有 Mock 状态和结果显示“模拟数据”或 “DEMO”声明。
- 首页调用 `startExam()` 后只把返回的不透明 `examId` 编码进 `/exam/:examId`，不解析其格式。
- ExamPage 在 React effect 中调用 `watchExam()`，并在 cleanup 中释放订阅；页面不创建轮询 timer。
- `completed`、`cancelled`、Adapter `error` 终态和状态查询拒绝分别呈现；内存中不存在的 `examId` 显示可返回首页的错误状态。

UI 不直接实例化或调用具体 Adapter，也不解析厂家原始字段。

## 未来真实设备接入点

取得正式厂家资料后，由 `RealDeviceAdapter` 实现同一接口。以下内容目前均为 `TBD`：

- 厂家、型号和协议版本。
- SDK、DLL、USB、串口、TCP 或 Web API 接入方式。
- 连接与检测调用映射。
- 厂家状态和错误码映射。
- SPH、CYL、AXIS 与 17 项正式字段映射。
- 是否需要 Local Device Bridge。

确认资料前不得在本契约中补写猜测内容。
