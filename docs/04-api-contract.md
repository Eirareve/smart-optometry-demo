# DeviceAdapter API Contract

## 范围与状态

本文记录网页 Demo 内部的 TypeScript 设备契约。它用于统一当前 `MockDeviceAdapter` 和未来 `RealDeviceAdapter` 对 Exam Service 提供的能力，**不是厂家设备接口文档**，不代表任何厂家已经支持这些方法。

当前已完成类型、接口定义和 `MockDeviceAdapter` 内存实现；尚未实现真实设备通讯、HTTP API、本地设备桥接服务、Exam Service 或 UI 接入。

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
```

## 接口

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

## 当前 Mock 实现

`MockDeviceAdapter implements DeviceAdapter`，没有修改上述 7 个方法或领域类型。它是明确标记的纯内存 Demo 数据源，不包含真实厂家名称、型号、接口、协议或硬件能力声明。

### 连接与设备状态

- 初始状态为 `connectionState: disconnected`、`operatingState: unknown`。
- `connect()` 使用集中配置的短暂延迟，返回 `MOCK-OPT-001` / `Smart Optometry Mock Device`。
- 连接成功后按当前契约返回 `connectionState: connected`、`operatingState: idle`，并在 `message` 中明确设备为 Mock/Demo 且已就绪。
- `ready` 不是 `DeviceStatus` 的枚举值；它仍属于未来 Exam Service 组织的 UI 流程状态，因此本次没有扩展或修改 contract。
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

后续持续查询的频率、停止条件、超时、取消定时器和错误处理由 Exam Service 负责。React 页面只消费 Exam Service 提供的应用状态，不直接实现轮询。

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

这些只表示单次检测会话的阶段。设备是否连接、空闲、忙碌或异常由 `DeviceStatus` 表示；`idle`、`connecting` 和 `ready` 由未来 Exam Service 结合两类状态组织，不属于 `ExamStatus`。

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
- 调用时序、有限轮询或未来事件订阅，并负责停止条件和超时。
- 取消、超时、重试和错误转换策略。
- 向 UI 提供与具体 Adapter 无关的应用状态。

### UI 负责

- 发出连接、开始、取消等用户意图。
- 呈现 Exam Service 提供的状态和标准结果。
- 对所有 Mock 状态和结果显示“模拟数据”或 “DEMO”声明。

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
