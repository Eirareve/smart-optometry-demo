# Smart Optometry Demo

Smart Optometry Demo（智能验光 Demo）是一个面向智能验光设备的软件原型项目。

当前产品阶段为**网页 Demo**。项目目标是验证设备型应用的交互闭环、验光流程状态、数据抽象与报告呈现方式，并为后续通过统一设备适配层接入厂家正式接口预留架构。

当前尚未取得厂家接口资料，也未接入真实设备。未来 Demo 中出现的设备状态和验光数据都必须明确标记为模拟数据，不构成医疗诊断或处方依据。除 SPH、CYL、AXIS 外，尚未定义的 17 项数据统一使用 `metric_01`～`metric_17` 作为扩展指标占位，不赋予医学名称。

## 当前状态

Phase 1 首页、统一 `DeviceAdapter` 抽象契约、`MockDeviceAdapter`、`ExamService`、模拟验光进行页和验光结果页已完成。
首页通过共享 ExamService 接入 Mock Device；设备连接后，“开始智能验光”会创建检测会话并导航到 `/exam/:examId`。

检测页实时呈现 `preparing → left_eye → right_eye → analyzing → completed`、进度、左右眼状态、分析状态、取消和内存会话丢失错误。检测完成后可进入 `/results/:examId`，通过 ExamService 读取标准 `ExamResult`，展示 OD/OS 的 SPH、CYL、AXIS、17 项中性扩展指标、时间与 Mock 数据来源。报告页尚未实现，真实设备尚未接入。

## 本地运行

```bash
npm install
npm run dev
```

验证命令：

```bash
npm run typecheck
npm run build
npm run lint
npm test
```

## Roadmap

### v0.1 — 网页 Demo

- 建立网页高保真 Demo
- 使用 Mock Device 模拟设备状态与检测数据
- 实现检测状态机
- 展示 SPH、CYL、AXIS 与 17 项扩展指标占位
- 提供模拟电子验光报告

### v0.2 — 厂家接口分析与 PoC

- 获取并核验厂家正式接口资料
- 分析协议、运行环境、字段定义和错误码
- 验证真实设备连接 PoC
- 采集并保留一份完整原始数据

### v0.3 — 真实设备适配

- 基于正式资料实现 Real Device Adapter
- 完善错误恢复与设备通讯日志
- 让 Mock 与 Real Adapter 遵循同一套契约

### v0.4 — 业务能力扩展

- 设计智能问诊流程
- 完善标准化验光报告

### v1.0 — 稳定交付

- 建立稳定的真实设备接入能力
- 完成端到端数据闭环
- 完善部署、监控、安全与隐私保护


