# 智能验光 Demo V0.1 —— 项目规划与 Codex 开发说明

> 文档用途：把本文件放到项目仓库根目录，作为产品范围、技术架构、开发顺序和 Codex 协作规范的统一依据。  
> 当前目标：**先做一个可在浏览器运行、视觉效果完整、交互流程真实的智能验光 Demo。**  
> 当前不依赖真实验光设备，不假设厂家“17 项数据”的具体含义；设备接口资料到位后，再把 Mock 数据层替换成真实设备适配层。

---

## 0. 给 Codex 的第一条任务说明

在开始编码前，请先完整阅读本文件，然后遵守以下原则：

1. 先完成网页 Demo，不要自行扩展为商城、配镜、3D 试戴、支付或眼镜加工系统。
2. 当前没有真实厂家接口资料，所有设备通讯必须通过 `MockDeviceAdapter` 模拟。
3. 不要虚构厂家 API、SDK、串口协议、17 项医学字段或设备能力。
4. 已知的屈光展示字段只用于 Demo，包括：
   - SPH（球镜）
   - CYL（柱镜/散光）
   - AXIS（轴位）
5. 未知的 17 项输出统一使用：
   - `metric_01`
   - `metric_02`
   - ...
   - `metric_17`
   页面显示为“扩展检测指标 01～17”，不要擅自赋予医学名称。
6. 所有 Demo 验光数据必须明确标记为**模拟数据**，不得被描述为医疗诊断结果。
7. 架构必须允许未来在不大改 UI 的情况下，把 Mock 数据源换成真实设备。
8. 每完成一个主要阶段，必须同步维护相关 Markdown 文档。
9. 不允许把所有业务逻辑直接写进 React 页面组件。
10. 修改代码后必须运行项目已有的 lint、typecheck、test、build，并报告结果。
11. 不要为了“看起来完成”而静默吞掉错误；设备状态、异常状态、空数据状态都要有明确 UI。
12. 如果本规划与实际厂家接口资料冲突，以未来正式接口文档为准，并先更新文档再修改实现。

推荐在仓库根目录另外创建 `AGENTS.md`，把上述 Codex 规则精炼写入。OpenAI 官方 Codex 支持通过仓库中的 `AGENTS.md` 提供代码库说明、运行测试方式和项目规范。

---

# 1. 项目背景

最终产品方向是“智能验光仓”，核心能力包括：

1. 验光前智能问诊；
2. 控制验光设备启动检测；
3. 采集验光与眼健康相关数据；
4. 展示屈光、散光等结果；
5. 生成验光/眼部健康相关报告；
6. 将标准化数据提供给其他业务系统。

但当前阶段有两个限制：

- 尚未取得厂家设备接口资料；
- 尚未取得所谓“17 项数据”的正式字段定义。

因此 V0.1 不做真实硬件通讯，而是做一个**可演示、可扩展、以后能接真设备**的网页 Demo。

---

# 2. 当前 Demo 的核心目标

Demo 成功标准不是“做很多功能”，而是完整演示以下闭环：

```text
进入系统
  ↓
看到设备状态
  ↓
点击“开始智能验光”
  ↓
模拟设备准备
  ↓
模拟左眼数据采集
  ↓
模拟右眼数据采集
  ↓
模拟数据分析
  ↓
显示验光结果
  ↓
显示 17 项扩展指标
  ↓
查看电子验光报告
  ↓
可重新检测
```

老板看到 Demo 后，应能够快速理解：

- 最终软件大概长什么样；
- 用户如何操作；
- 设备接入后数据会出现在哪里；
- 报告如何呈现；
- 后续真实硬件如何替换 Mock 数据。

---

# 3. V0.1 明确不做的内容

以下内容不要在本阶段实现：

- 真实硬件通讯；
- 厂家 SDK；
- USB/串口/TCP 私有协议；
- 真实的 17 项医学指标定义；
- AI 医疗诊断；
- 疾病判断；
- 3D 人脸扫描；
- 3D 数字人；
- 镜框推荐；
- 虚拟试戴；
- 瞳高二次扫描；
- 镜片加工参数；
- 商品、库存、订单；
- 支付；
- 复杂用户权限；
- HIS/EMR 等医疗系统正式集成。

---

# 4. 推荐技术栈

## 4.1 V0.1 网页 Demo

推荐：

- React
- TypeScript
- Vite
- React Router
- Zustand 或简单 React Context（状态不复杂时优先简单）
- Tailwind CSS
- ESLint
- Prettier
- Vitest
- React Testing Library

原则：

- 不为了“技术炫技”引入重型框架；
- 不使用复杂微服务；
- Demo 可直接 `npm run dev` 启动；
- 以后真实设备接入时保留现有前端。

## 4.2 未来真实设备接入

如果厂家提供 Windows DLL、SDK、串口、USB 或 TCP 私有协议，推荐增加：

```text
浏览器前端
    │
    │ HTTP / WebSocket
    ▼
本地设备桥接服务
.NET / C#
    │
    ▼
Device Adapter
    │
    ├── 厂家 DLL
    ├── SDK
    ├── Serial
    ├── USB
    └── TCP
        │
        ▼
      验光设备
```

原因：

- 浏览器不适合直接承载大多数厂家 Windows SDK/DLL；
- 硬件通讯、重连、超时、原始报文解析应与 UI 解耦；
- .NET/C# 对 Windows DLL、串口和桌面设备集成通常更方便。

如果厂家未来明确提供标准 HTTP/REST/WebSocket API，再根据其官方协议决定是否直接调用。

---

# 5. 系统架构

V0.1：

```text
┌──────────────────────────────┐
│          React UI            │
│                              │
│ 首页 / 检测页 / 结果 / 报告  │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│        Exam Service          │
│ 验光流程、状态机、结果组织    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│      DeviceAdapter 接口      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     MockDeviceAdapter        │
│ 当前：模拟设备               │
└──────────────────────────────┘
```

未来：

```text
DeviceAdapter
     │
     ├── MockDeviceAdapter
     │
     └── RealDeviceAdapter
              │
              ▼
       Local Device Bridge
              │
              ▼
         Vendor SDK/API
```

UI 不应感知底层到底是 Mock 还是真设备。

---

# 6. 核心接口设计

建议定义统一设备接口：

```ts
export interface DeviceAdapter {
  connect(): Promise<DeviceInfo>;
  disconnect(): Promise<void>;
  getStatus(): Promise<DeviceStatus>;
  startExam(): Promise<ExamSession>;
  cancelExam(examId: string): Promise<void>;
  getExamStatus(examId: string): Promise<ExamStatus>;
  getExamResult(examId: string): Promise<ExamResult>;
}
```

未来如果采用事件流，可以增加：

```ts
subscribe(
  listener: (event: DeviceEvent) => void
): () => void;
```

---

# 7. 验光状态机

不要只用一个 `loading: true/false`。

建议：

```ts
type ExamStage =
  | "idle"
  | "connecting"
  | "ready"
  | "preparing"
  | "left_eye"
  | "right_eye"
  | "analyzing"
  | "completed"
  | "cancelled"
  | "error";
```

典型流程：

```text
idle
 ↓
connecting
 ↓
ready
 ↓
preparing
 ↓
left_eye
 ↓
right_eye
 ↓
analyzing
 ↓
completed
```

异常可从执行状态进入：

```text
error
cancelled
```

每个状态都要有对应 UI。

---

# 8. 页面规划

## 8.1 首页 `/`

目标：形成“智能医疗设备控制台”的第一印象。

展示：

- 产品名称：智能验光系统；
- Demo 模式明显标签；
- 设备名称；
- 设备编号；
- 连接状态；
- 最后通信时间；
- 今日模拟检测次数；
- “开始智能验光”主按钮；
- 可选“设备详情”区域。

示例信息：

```text
智能验光系统                         DEMO MODE

设备状态
● 已连接

设备：智能验光设备
编号：OPT-DEMO-001
状态：待机
最后通信：刚刚

[ 开始智能验光 ]
```

---

## 8.2 检测页 `/exam`

展示：

- 当前阶段；
- 大型眼睛/扫描视觉元素；
- 进度条；
- 左眼、右眼状态；
- 操作提示；
- 取消检测按钮。

模拟节奏建议：

```text
0~1.5s   设备准备
1.5~4s   左眼数据采集
4~6.5s   右眼数据采集
6.5~8s   数据分析
8s       完成
```

开发环境可以提供“快速演示模式”。

---

## 8.3 结果页 `/results/:examId`

顶部展示：

- 检测完成；
- 检测编号；
- 检测时间；
- “模拟数据”标签。

核心屈光数据：

| 字段 | 右眼 OD | 左眼 OS |
|---|---:|---:|
| SPH | -2.50 D | -2.75 D |
| CYL | -0.75 D | -0.50 D |
| AXIS | 175° | 10° |

17 项扩展指标：

```text
扩展检测指标 01
扩展检测指标 02
...
扩展检测指标 17
```

这些字段使用中性名称，直到厂家给出正式协议。

按钮：

- 查看报告；
- 重新检测；
- 返回首页。

---

## 8.4 报告页 `/report/:examId`

展示：

- 报告编号；
- 检测时间；
- 左右眼屈光数据；
- 扩展检测指标；
- 数据来源；
- Demo 声明；
- 打印按钮；
- 返回结果按钮。

报告中不要出现疾病诊断。

推荐声明：

> 本页面当前使用模拟设备数据，仅用于软件原型与交互流程验证，不构成医疗诊断或处方依据。

---

## 8.5 可选调试页 `/developer/device`

仅开发环境显示，用来展示：

- 当前 DeviceAdapter；
- 设备状态；
- 当前 examId；
- 状态机阶段；
- Mock 原始返回 JSON；
- 模拟“断线”；
- 模拟“超时”；
- 模拟“设备忙”；
- 模拟“返回异常”。

这对以后接真设备非常有价值。

---

# 9. 视觉设计要求

设计关键词：

- 医疗设备；
- 科技感；
- 专业；
- 简洁；
- 高可信；
- 不像传统后台管理系统。

建议：

- 大面积留白或低饱和深色背景；
- 蓝/青色作为状态强调色；
- 大号数字；
- 圆角卡片；
- 清晰的 OD / OS 左右眼分区；
- 动态进度；
- 状态灯；
- 少表格，多卡片；
- 桌面大屏优先，同时保证基础响应式。

不要做成：

```text
用户管理 | 权限管理 | 商品管理 | 订单管理 | ...
```

当前产品是“设备型应用”，不是 ERP。

---

# 10. Demo 数据模型

```ts
export interface EyeRefraction {
  sphere: number;
  cylinder: number;
  axis: number;
}

export interface ExtendedMetric {
  code: string;
  displayName: string;
  value: string | number;
  unit?: string;
  status?: "normal" | "attention" | "unknown";
}

export interface ExamResult {
  examId: string;
  source: "mock" | "device";
  rightEye: EyeRefraction;
  leftEye: EyeRefraction;
  metrics: ExtendedMetric[];
  rawData: unknown;
  startedAt: string;
  completedAt: string;
}
```

注意：

- `rawData` 必须保留；
- `metrics` 必须可扩展；
- 不把 17 项字段硬编码成业务实体；
- 后续厂家字段映射应独立实现。

---

# 11. Mock 数据要求

Mock 数据要像真实设备，但必须明确是模拟。

示例：

```json
{
  "examId": "EX-DEMO-0001",
  "source": "mock",
  "rightEye": {
    "sphere": -2.5,
    "cylinder": -0.75,
    "axis": 175
  },
  "leftEye": {
    "sphere": -2.75,
    "cylinder": -0.5,
    "axis": 10
  },
  "metrics": [
    {
      "code": "metric_01",
      "displayName": "扩展检测指标 01",
      "value": "Demo Value",
      "status": "unknown"
    }
  ]
}
```

必须生成完整 17 项。

不要将这些占位字段命名为眼压、角膜厚度、眼轴等，除非未来厂家文档明确确认。

---

# 12. 未来需要向老板/厂家索取的资料

拿到资料之前，不阻塞 V0.1 开发。

未来必须确认：

## 12.1 连接方式

- USB？
- 串口？
- RS232/RS485？
- TCP/IP？
- HTTP REST API？
- WebSocket？
- Windows DLL？
- SDK？

## 12.2 基础设备能力

需要确认厂家是否提供：

- connect；
- disconnect；
- getDeviceInfo；
- getStatus；
- startExam；
- cancelExam；
- getProgress；
- getResult；
- error code；
- event callback。

## 12.3 数据协议

必须得到：

- 完整字段名；
- 字段 code；
- 数据类型；
- 单位；
- 左右眼标识；
- 合法范围；
- 空值规则；
- 异常值；
- 状态码；
- 一次完整真实返回样例；
- 协议版本号。

## 12.4 运行环境

确认：

- Windows 版本；
- x64/x86；
- DLL 依赖；
- 驱动；
- SDK Runtime；
- USB Driver；
- 端口权限；
- 是否允许并发；
- 是否要求设备软件同时运行。

---

# 13. 我们自己的 API 抽象

即使厂家协议未知，也可以先定义“我们希望前端看到的统一 API”。

未来本地设备桥接服务建议：

```http
GET /api/device/status
POST /api/device/connect
POST /api/device/disconnect

POST /api/exams
GET /api/exams/{examId}/status
GET /api/exams/{examId}/result
POST /api/exams/{examId}/cancel

GET /api/exams/{examId}/raw
```

事件流可选：

```text
WebSocket /ws/device-events
```

事件示例：

```json
{
  "type": "exam.stage.changed",
  "examId": "EX-001",
  "stage": "left_eye",
  "progress": 35
}
```

注意：以上是**我们内部预留的统一接口设计，不是厂家接口**。

---

# 14. API 接入文档必须怎么写

Codex 在创建实现时，必须生成：

`docs/device-integration.md`

至少包含：

## A. 当前 Demo

```text
UI
 ↓
DeviceAdapter
 ↓
MockDeviceAdapter
```

说明：

- Mock 如何启动；
- Mock 的延迟如何配置；
- Mock 数据放在哪里；
- 如何模拟异常。

## B. 未来厂家 API

必须留下模板：

```md
# 厂家设备接口接入记录

## 厂家
TBD

## 型号
TBD

## 协议版本
TBD

## 接入方式
TBD

## SDK/DLL
TBD

## 连接流程
TBD

## 启动检测
TBD

## 状态查询
TBD

## 数据返回
TBD

## 17项字段映射
TBD

## 错误码
TBD

## 原始示例
TBD

## 已知限制
TBD
```

没有资料的字段必须写 `TBD`，不能猜。

---

# 15. 推荐项目目录

```text
smart-optometry-demo/
├─ README.md
├─ AGENTS.md
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ .gitignore
├─ .env.example
│
├─ docs/
│  ├─ 01-product-scope.md
│  ├─ 02-architecture.md
│  ├─ 03-device-integration.md
│  ├─ 04-api-contract.md
│  ├─ 05-data-model.md
│  ├─ 06-development-log.md
│  ├─ 07-decisions.md
│  └─ 08-test-plan.md
│
├─ src/
│  ├─ app/
│  │  ├─ router.tsx
│  │  └─ App.tsx
│  │
│  ├─ pages/
│  │  ├─ HomePage.tsx
│  │  ├─ ExamPage.tsx
│  │  ├─ ResultPage.tsx
│  │  ├─ ReportPage.tsx
│  │  └─ DeviceDebugPage.tsx
│  │
│  ├─ components/
│  │  ├─ DeviceStatusCard.tsx
│  │  ├─ ExamProgress.tsx
│  │  ├─ EyeResultCard.tsx
│  │  ├─ MetricGrid.tsx
│  │  └─ DemoBadge.tsx
│  │
│  ├─ domain/
│  │  ├─ device.ts
│  │  ├─ exam.ts
│  │  └─ result.ts
│  │
│  ├─ services/
│  │  ├─ examService.ts
│  │  └─ device/
│  │     ├─ DeviceAdapter.ts
│  │     ├─ MockDeviceAdapter.ts
│  │     └─ index.ts
│  │
│  ├─ mocks/
│  │  ├─ exam-result.json
│  │  └─ scenarios.ts
│  │
│  ├─ store/
│  ├─ hooks/
│  ├─ utils/
│  └─ styles/
│
└─ tests/
```

目录可以根据实际开发微调，但 DeviceAdapter、业务服务和 UI 必须保持解耦。

---

# 16. Codex 必须维护的 Markdown 文档

## `README.md`

给 GitHub 访客看，包含：

- 项目简介；
- 当前 Demo 截图；
- 核心流程；
- 技术栈；
- 快速启动；
- 当前状态；
- 架构简图；
- Roadmap；
- Demo 数据声明。

## `AGENTS.md`

给 Codex 看，包含：

- 项目范围；
- 编码规范；
- 测试命令；
- 禁止事项；
- 文档维护要求；
- 不得虚构厂家协议。

## `docs/01-product-scope.md`

记录：

- 为什么做；
- 当前解决什么；
- 当前不解决什么。

## `docs/02-architecture.md`

记录：

- UI；
- Service；
- DeviceAdapter；
- Mock；
- 未来 Real Adapter；
- 数据流；
- 状态机。

## `docs/03-device-integration.md`

记录：

- Mock 接入；
- 未来真实设备接入步骤；
- 厂家资料 TBD 清单。

## `docs/04-api-contract.md`

记录内部 API/Adapter contract。

## `docs/05-data-model.md`

记录：

- Exam；
- EyeRefraction；
- ExtendedMetric；
- rawData；
- 字段含义。

## `docs/06-development-log.md`

每一阶段更新：

```text
日期
本次目标
完成内容
我做出的决策
Codex 辅助内容
我人工检查/修改的内容
测试结果
未解决问题
下一步
```

## `docs/07-decisions.md`

用轻量 ADR 方式记录重要决策：

```text
DEC-001 使用 React + TypeScript
DEC-002 V0.1 使用 Mock Device
DEC-003 17项采用扩展字段而非硬编码
DEC-004 未来设备协议放到 Local Bridge
```

每条至少写：

- Context；
- Decision；
- Reason；
- Consequence。

## `docs/08-test-plan.md`

包含：

- 正常流程；
- 取消；
- 断线；
- 超时；
- 异常数据；
- 重复检测；
- 页面刷新；
- 结果为空。

---

# 17. Codex 开发顺序

不要一次生成完整项目后就结束。

## Phase 0：初始化

完成：

- Vite + React + TypeScript；
- lint；
- test；
- router；
- Tailwind；
- README；
- AGENTS.md；
- docs 骨架。

验收：

```bash
npm install
npm run dev
npm run build
npm run lint
npm test
```

---

## Phase 1：首页

完成：

- 医疗科技风首页；
- DeviceStatusCard；
- Demo Mode；
- 开始验光按钮；
- 模拟连接状态。

只做首页，不做结果页。

---

## Phase 2：Mock Device

完成：

- `DeviceAdapter`；
- `MockDeviceAdapter`；
- 连接；
- 状态；
- startExam；
- cancel；
- result；
- mock error scenario。

补单元测试。

---

## Phase 3：检测流程

完成：

- `/exam`；
- 状态机；
- 进度；
- 左眼；
- 右眼；
- 数据分析；
- 完成跳转；
- 取消。

---

## Phase 4：结果页

完成：

- OD / OS；
- SPH / CYL / AXIS；
- 17 项占位；
- 模拟数据警告；
- 原始数据调试入口。

---

## Phase 5：报告

完成：

- 报告页；
- 浏览器打印样式；
- 返回结果；
- 重新验光。

V0.1 不要求生成服务器 PDF。

---

## Phase 6：异常演示

完成：

- 设备断线；
- 检测超时；
- 返回异常；
- 设备忙；
- 重试。

---

## Phase 7：文档与作品集整理

完成：

- README 截图；
- 架构图；
- Roadmap；
- docs 完整；
- GitHub Issue；
- Release `v0.1.0-demo`。

---

# 18. 每次交给 Codex 的任务应该多大

推荐“一次一个可验证目标”。

好：

```text
阅读 PROJECT_PLAN.md 和 AGENTS.md。
本次只实现首页 DeviceStatusCard 和 Demo 模式标签。
不要实现检测页。
完成后运行 lint、test、build，
并更新 docs/06-development-log.md。
```

好：

```text
实现 DeviceAdapter 和 MockDeviceAdapter。
不要修改 UI 风格。
为 connect、startExam、cancelExam、getExamResult 添加测试。
完成后更新 03-device-integration.md 和 04-api-contract.md。
```

不推荐：

```text
帮我把整个智能验光系统全部做完。
```

原因是大任务会让你失去对架构和提交历史的掌控。

---

# 19. 验收清单

V0.1 完成时至少满足：

- [ ] 首页视觉完整；
- [ ] 明确展示 DEMO；
- [ ] 可以点击开始；
- [ ] 检测流程会自动推进；
- [ ] 可以取消；
- [ ] 可以重新检测；
- [ ] 左右眼数据显示正确；
- [ ] 显示 SPH/CYL/AXIS；
- [ ] 显示 17 项扩展占位字段；
- [ ] 不虚构医学名称；
- [ ] 显示模拟数据声明；
- [ ] 报告页可查看；
- [ ] DeviceAdapter 与 UI 解耦；
- [ ] MockDeviceAdapter 可单独测试；
- [ ] rawData 被保留；
- [ ] 至少有一个错误场景；
- [ ] `npm run build` 成功；
- [ ] lint 成功；
- [ ] test 成功；
- [ ] README 完整；
- [ ] device integration 文档完整；
- [ ] development log 持续更新。

---

# 20. 获取厂家资料后的升级步骤

资料拿到后不要马上改 UI。

按顺序：

1. 建立 `docs/vendor/`；
2. 保存厂家协议版本信息；
3. 填写 `docs/03-device-integration.md`；
4. 建立字段映射表；
5. 编写 `RealDeviceAdapter`；
6. 若为 DLL/串口/USB/TCP，建立本地 Device Bridge；
7. 编写通讯日志；
8. 先验证连接；
9. 再验证启动检测；
10. 再验证拿到一份完整原始结果；
11. 保存 rawData；
12. 映射到标准 `ExamResult`；
13. Mock 与 Real 使用同一套 contract tests；
14. 最后才让正式 UI 使用 Real Device。

---

# 21. 厂家接口字段映射模板

未来创建：

`docs/vendor/field-mapping.md`

```md
| 厂家字段 | 我方字段 | 类型 | 单位 | 左/右眼 | 示例 | 是否必填 | 备注 |
|---|---|---|---|---|---|---|---|
| TBD | rightEye.sphere | number | D | OD | -2.50 | TBD | TBD |
| TBD | rightEye.cylinder | number | D | OD | -0.75 | TBD | TBD |
| TBD | rightEye.axis | number | ° | OD | 175 | TBD | TBD |
| TBD | metrics.metric_01 | TBD | TBD | TBD | TBD | TBD | TBD |
```

未确认内容只写 `TBD`。

---

# 22. 安全与隐私要求

即使是 Demo，也遵守：

- 不提交真实患者数据；
- GitHub 公共仓库只使用合成/模拟数据；
- 不提交身份证、手机号、人脸数据；
- 不提交厂家密钥；
- 不提交 API Key；
- 不提交 `.env`；
- 不提交厂商有保密要求的 SDK/DLL；
- 使用 `.env.example` 展示配置字段；
- 正式环境未来需要设计审计、访问控制、数据加密和隐私合规。

---

# 23. 建议 README 中的项目定位

可表达为：

> Smart Optometry Demo 是一个面向智能验光设备的软件原型，当前使用 Mock Device 模拟设备连接、检测状态和验光结果。项目重点验证设备控制流程、数据抽象、验光状态机和报告交互，并为后续通过 Device Adapter 接入真实厂家 SDK/API 预留架构。

不要写：

> 已成功接入 XX 医疗设备。

除非真的完成。

---

# 24. V0.1 Roadmap

```text
v0.1
网页高保真 Demo
Mock Device
检测状态机
验光结果
报告页面

v0.2
厂家接口分析
真实设备连接 PoC
原始数据采集

v0.3
真实 Device Adapter
错误恢复
设备日志

v0.4
智能问诊
标准化验光报告

v1.0
稳定设备接入
完整数据闭环
部署与运行监控
```

---

# 25. 本阶段最终交付物

Codex 完成 V0.1 后，仓库至少应该拥有：

```text
运行中的网页 Demo
+
清晰的 React/TypeScript 源码
+
MockDeviceAdapter
+
测试
+
README
+
AGENTS.md
+
产品范围文档
+
架构文档
+
设备接入文档
+
API Contract
+
数据模型文档
+
开发日志
+
技术决策记录
+
测试计划
```

这套结构不仅用于向老板展示，也能作为 GitHub 作品集，体现你对：

- 产品边界；
- 前端工程；
- 设备集成；
- API 抽象；
- 状态机；
- 数据建模；
- 测试；
- 文档；
- 迭代开发；

的理解。

---

# 26. 官方参考

- OpenAI Codex：https://openai.com/index/introducing-the-codex-app/
- OpenAI Codex / AGENTS.md 说明：https://openai.com/zh-Hans-CN/index/introducing-codex/
- GitHub README 最佳实践：https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes
