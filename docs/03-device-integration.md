# 设备接入说明

## 当前状态

- 当前产品阶段：网页 Demo。
- 当前代码状态：已定义 `DeviceAdapter` 及标准领域类型，尚未实现 Mock 或真实设备适配器。
- 真实设备：未接入。
- 厂家接口资料：尚未取得。
- 17 项正式字段定义：尚未取得。

在正式资料到位前，不得编写或声称存在厂家 API、SDK、DLL、协议、错误码或医学字段映射。

## 当前 DeviceAdapter 契约

我方内部统一接口位于 `src/services/device/DeviceAdapter.ts`，业务错误位于 `src/services/device/DeviceAdapterError.ts`，领域类型位于 `src/domain/`。当前契约覆盖连接、断开、设备状态、启动检测、取消检测、检测状态和结果读取。详细方法、单检测并发规则、轮询责任与错误码见 `docs/04-api-contract.md`。

该契约是未来 Mock 与 Real Adapter 共同遵循的我方标准，不是厂家 API。当前没有任何设备通讯实现，首页也尚未调用此接口。

## V0.1 Mock 接入计划

```text
UI → Exam Service → DeviceAdapter → MockDeviceAdapter
```

Mock 的目标是支持网页 Demo 的连接状态、检测阶段、取消、完成结果和可控异常。它不是厂家设备的仿真规范，也不代表真实设备能力。

未来 Mock 必须遵守“一台设备只有一个活动检测”的契约，并覆盖 `DEVICE_NOT_CONNECTED`、`DEVICE_BUSY`、`EXAM_NOT_FOUND`、`EXAM_NOT_COMPLETED` 和 `EXAM_ALREADY_FINISHED`。这些是我方业务错误码，不是厂家错误码。

Mock 实现计划放在 `src/services/device/`，但具体文件、启动方式、延迟配置、数据文件位置和异常开关将在 Mock 实现完成后确认。目前统一为 `TBD`。

Mock 数据规则：

- 必须标记来源为 `mock` 或“模拟数据”。
- 可展示 Demo 用 SPH、CYL、AXIS。
- 未知 17 项的 code 仅使用 `metric_01`～`metric_17`。
- 未知 17 项的显示名仅使用“扩展检测指标 01”～“扩展检测指标 17”。
- 不赋予未知项医学名称、医学单位、合法范围或诊断状态。
- 原始模拟返回保留在 `rawData`，便于调试数据映射。

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
