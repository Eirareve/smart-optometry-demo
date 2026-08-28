# 架构说明

## 文档状态

本文描述 V0.1 网页 Demo 的目标架构。当前已完成 React 基础工程、首页 UI、`DeviceAdapter` 抽象契约、`MockDeviceAdapter` 和 `ExamService` 验光流程编排层；`ExamService` 尚未接入 UI，检测页、结果页和报告页尚未实现，真实设备未接入。

## V0.1 分层

```text
浏览器中的网页 UI
  │  只表达用户意图和渲染状态
  ▼
ExamService（当前已实现，尚未接入 UI）
  │  负责流程、状态机、取消、异常与结果组织
  ▼
DeviceAdapter
  │  我方内部统一设备契约
  ▼
MockDeviceAdapter（当前已实现）
     仅提供明确标记的模拟状态与模拟数据
```

依赖方向始终由上层指向抽象。页面不能导入 `MockDeviceAdapter` 或未来的 `RealDeviceAdapter`，也不能直接承担设备连接、轮询、取消和原始数据转换逻辑。

### UI

当前已实现首页，包含 Demo 标识、设备状态卡和操作入口。首页仍只呈现明确的“设备未接入”静态状态，尚未连接 `DeviceAdapter`。检测页、结果页、报告页和可选开发调试页不在本阶段实现范围。

### Exam Service

`src/services/exam/ExamService.ts` 已实现 React UI 与设备抽象之间的流程编排层。它通过构造函数接收 `DeviceAdapter`，不会自行创建 `MockDeviceAdapter` 或未来的真实设备实现。当前提供：

- 连接、断开和读取设备状态的业务入口。
- 启动检测并返回 `ExamSession`，其中 `examId` 继续作为不透明标识传递。
- 监听检测状态、主动取消以及读取完成结果。
- 对同一 `examId` 共享唯一轮询链，并向多个观察者发布状态变化。
- 在 `completed`、`cancelled`、`error` 或状态查询拒绝后停止轮询。
- 通过单次订阅 cleanup 或服务级 `dispose()` 清理定时器和失效化在途查询。

结果读取只委托 `DeviceAdapter.getExamResult(examId)`；ExamService 不生成、补齐或缓存验光数据。当前首页仍未装配该服务，后续页面只向 ExamService 发出意图并消费标准状态，不直接操作 Adapter 或定时器。

### DeviceAdapter

`src/services/device/DeviceAdapter.ts` 已定义我方内部的统一设备边界：

- `connect()`
- `disconnect()`
- `getStatus()`
- `startExam()`
- `cancelExam(examId)`
- `getExamStatus(examId)`
- `getExamResult(examId)`

接口只描述上层需要的能力，不描述或暗示任何厂家 API、SDK、DLL、协议和错误码。具体方法语义与数据结构见 `docs/04-api-contract.md`。

`src/services/device/DeviceAdapterError.ts` 另外定义我方统一业务错误码。它用于区分未连接、设备忙、检测不存在、检测未完成和检测已结束，不对应任何厂家私有错误码。

### Domain 类型

标准类型按职责放置，避免页面和设备实现各自重复定义：

```text
src/domain/device.ts  → DeviceInfo、DeviceStatus、设备状态枚举
src/domain/exam.ts    → ExamSession、ExamStatus、ExamStage
src/domain/result.ts  → ExamResult、EyeRefraction、ExtendedMetric
src/domain/index.ts   → 领域类型统一导出
```

这些类型只表达我方稳定的数据模型。厂家私有字段未来由独立映射层转换，未经转换的返回保存在 `ExamResult.rawData`。

### MockDeviceAdapter

`src/services/device/MockDeviceAdapter.ts` 已实现同一个 `DeviceAdapter`，用于提供明确标记的模拟连接状态、按时间推导的检测阶段、取消和完成结果；其行为不代表真实厂家设备规范。实现用内存 Map 保存检测记录，并用单一 `activeExamId` 保证一台 Mock Device 同时只有一个活动检测。普通 Demo 和测试时间均由同一文件中的配置集中管理。

Mock 尚未接入 UI；当前 ExamService 测试通过 `DeviceAdapter` 类型注入 `MockDeviceAdapter`，验证了两层可以解耦协作。未来页面装配时，页面仍不能直接导入具体 Adapter；未来 Real Adapter 也在同一装配边界替换 Mock，而不是改写页面或 ExamService。

## 状态边界

`DeviceAdapter` 当前定义两类职责不同的状态快照：

- `DeviceStatus`：设备是否连接，以及整体处于空闲、忙碌或错误状态；不表达检测阶段。
- `ExamStatus`：某个 `examId` 对应的单次检测阶段与可选进度；不表达设备连接状态。

设备侧检测阶段为：

```text
preparing → left_eye → right_eye → analyzing → completed
```

执行中的检测也可以进入：

```text
cancelled
error
```

`idle`、`connecting` 和 `ready` 属于未来 UI 接入时组合的页面流程状态，不与单次检测会话的 `ExamStatus` 混为一谈。本次 ExamService 只发布现有 `ExamStatus` 的七个检测阶段，没有扩展领域枚举；页面不得用单一 `loading` 值替代这些状态。

## 轮询与订阅生命周期

```text
watchExam(examId, observer)
  → 立即调用一次 DeviceAdapter.getExamStatus(examId)
  → 上一次查询完成后，再等待默认 500ms
  → 查询下一份快照
  → completed / cancelled / error：发布终态并停止
  → Promise reject：调用 observer.onError 并停止
```

轮询采用递归 `setTimeout`，不使用 `setInterval`。因此慢查询没有完成时不会启动下一次查询。同一 `examId` 的多个观察者共享一个 watcher 和一个在途 Promise，不会因为 React 重复订阅而创建多条轮询链。

`watchExam()` 返回幂等 cleanup。移除一个观察者不会影响同一检测的其他观察者；最后一个观察者离开后会清除待执行定时器、删除 watcher，并用 generation 与 Map identity 让已经在途的旧响应失效。`dispose()` 执行相同的服务级清理。cleanup 和 `dispose()` 只表示“不再观察”，不会把设备检测伪装成 `cancelled`；真正取消必须调用 `cancelExam(examId)`。

主动取消时，ExamService 先暂停该检测的后续轮询并失效化旧响应，再调用 Adapter 的 `cancelExam(examId)`。取消成功且仍有观察者时，服务会读取一次 Adapter 的最新状态并发布真实的 `cancelled` 快照；取消失败则恢复原 watcher 并向调用方抛出原错误。

## 契约不变量

- V0.1 一台设备一次只能有一个活动检测。
- 当检测处于 `preparing`、`left_eye`、`right_eye` 或 `analyzing` 时，设备为 `busy`；再次启动必须返回 `DEVICE_BUSY`，不能创建并发检测。
- `getExamResult()` 只有在检测为 `completed` 时才能返回结果；其他阶段返回 `EXAM_NOT_COMPLETED`，不能返回空对象或伪造结果。
- `cancelExam()` 只取消进行中的检测；成功后该检测进入 `cancelled`，已结束检测返回 `EXAM_ALREADY_FINISHED`。
- `getExamStatus()` 每次只返回一个快照。持续轮询、终态停止、查询错误和订阅清理由 ExamService 负责，Adapter 与 React 页面都不创建无限轮询。
- 所有时间字段使用 ISO 8601 字符串。

## 数据流

```text
用户操作
  → UI 发起意图
  → Exam Service 推进流程
  → DeviceAdapter 获取设备状态、检测状态或结果
  → 具体 Adapter 转换为标准领域模型
  → Exam Service 组织可呈现状态
  → UI 呈现模拟数据声明、结果或错误
```

标准结果保留：

- 左右眼 SPH、CYL、AXIS 对应的 `sphere`、`cylinder`、`axis`。
- 可扩展的 `metrics` 集合，不建立 17 个固定业务字段。
- V0.1 中性占位 `metric_01`～`metric_17`。
- 未经转换的 `rawData`。
- `source` 数据来源标识，用于区分 `mock` 与未来真实设备数据。

`rawData` 保持 `unknown`，只面向设备集成调试、受控日志和未来字段重新解析。普通 UI 不读取或依赖其内部结构。

## 未来真实设备接入

真实设备接入必须以厂家正式资料为依据。未来的 `RealDeviceAdapter` 将实现当前统一契约，并负责把桥接层或厂家正式接口的状态与结果转换为领域模型；UI 和 Exam Service 不因底层来源变化而改写。

如果厂家提供 Windows DLL、SDK、串口、USB 或 TCP 私有协议，候选结构为：

```text
网页 UI → Exam Service → DeviceAdapter → RealDeviceAdapter
                                      → Local Device Bridge
                                      → 厂家正式 SDK/API/协议
```

具体桥接技术、通信方法、错误映射和字段映射目前均为 `TBD`。如果厂家提供标准 Web API，应依据正式文档重新评估，而不是预先假定实现方式。

## 核心约束

- UI 不感知底层使用 Mock 还是真实设备。
- 厂家字段映射独立于页面和标准结果模型。
- 原始数据必须保留，映射失败不得静默忽略。
- 设备与检测标识作为不透明字符串传递，页面不解析其格式。
- 时间字段由 Adapter 输出 ISO 8601 字符串。
- 断线、超时、设备忙、取消、异常数据和空结果需要成为可观察状态。
