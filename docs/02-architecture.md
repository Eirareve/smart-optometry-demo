# 架构说明

## 文档状态

本文描述 V0.1 网页 Demo 的目标架构，当前尚未开始代码实现。

## V0.1 分层

```text
浏览器中的网页 UI
  │
  ▼
Exam Service
  │  负责流程、状态机与结果组织
  ▼
DeviceAdapter
  │  隔离 UI 与具体设备实现
  ▼
MockDeviceAdapter
     仅提供明确标记的模拟状态与模拟数据
```

### UI

计划包含首页、检测页、结果页、报告页，以及可选的开发调试页。UI 只依赖业务服务和稳定的数据契约，不直接调用 Mock 或未来的厂家实现。

### Exam Service

负责组织检测生命周期、状态转换、取消、异常和结果读取。页面组件不直接承载完整业务流程。

### DeviceAdapter

作为我方内部设备能力抽象，隔离上层流程与底层数据来源。其最终方法、参数和错误模型需在实现阶段验证；该抽象不是厂家 API 的描述。

### MockDeviceAdapter

V0.1 计划中的模拟实现，用于演示连接状态、检测阶段、结果和异常场景。所有输出必须标为模拟数据。

## 状态机

计划使用以下状态表达验光流程：

```text
idle → connecting → ready → preparing
     → left_eye → right_eye → analyzing → completed
```

执行中的状态可以进入：

```text
cancelled
error
```

每个状态都应有明确 UI，不使用单一 `loading` 值替代状态机。

## 数据流

```text
用户操作
  → UI 发起意图
  → Exam Service 推进流程
  → DeviceAdapter 获取状态或结果
  → Exam Service 组织标准化数据
  → UI 呈现模拟数据声明、结果或错误
```

结果模型计划保留：

- 左右眼 SPH、CYL、AXIS。
- 可扩展的 `metrics` 集合。
- `metric_01`～`metric_17` 中性占位。
- 未经转换的 `rawData`。
- 数据来源标识，用于区分 `mock` 与未来真实设备。

## 未来真实设备接入

真实设备接入必须以厂家正式资料为依据。如果厂家提供 Windows DLL、SDK、串口、USB 或 TCP 私有协议，计划在浏览器与设备之间增加本地设备桥接服务，并在其后实现 `RealDeviceAdapter`：

```text
网页 UI → Exam Service → DeviceAdapter → RealDeviceAdapter
                                      → Local Device Bridge
                                      → 厂家正式 SDK/API/协议
```

具体桥接技术、通信方法和字段映射目前均为 `TBD`。如果厂家提供标准 Web API，应依据正式文档重新评估，而不是预先假定实现方式。

## 核心约束

- UI 不感知底层使用 Mock 还是真实设备。
- 厂家字段映射独立于页面和标准结果模型。
- 原始数据必须保留，映射失败不得静默忽略。
- 断线、超时、设备忙、取消、异常数据和空结果需要成为可观察状态。
