## Context

LocateRoom 是一个 4 人实时位置共享网页应用，核心需求来自 `LocateRoom.md`。项目采用 WebRTC DataChannel 做位置数据 P2P 传输，WebSocket 信令服务器做连接协调，Leaflet + OSM 地图展示位置。

**原始需求的关键取舍要求**（来自需求文档）：
- README 必须包含：架构与取舍说明、性能实测数据、AI 协作说明
- AI 协作说明需包括：用了什么工具、怎么拆任务、推翻过哪些 AI 方案及原因

**当前状态**：
- 核心功能已实现并部署到阿里云 ECS
- 技术债务已知（断线重连、NAT 穿透、iOS 后台冻结）
- 已有 `知识扩展.md`（架构技术笔记）、`存疑.md`（问题记录）
- 缺乏一份正式的 README.md 整合项目全貌

## Goals / Non-Goals

**Goals:**
- 编写一份完整的 `README.md`，展示项目架构、技术取舍、性能数据和 AI 协作过程
- 从 `知识扩展.md` 中提取架构决策历程，转化为 README 中的"架构与取舍"章节
- 从实际开发经历中提取 AI 协作记录（工具、任务拆解、推翻的方案）

**Non-Goals:**
- 不包含 API 文档（项目无 HTTP API）
- 不包含部署运维细节（部署文档在 `openspec/changes/deploy-server/`）
- 不重写代码或修改功能，README 仅做文档组织

## Decisions

### Decision 1: 文档结构：按需求文档要求的三板块组织

**结论**：README 分为三大板块——架构与取舍、性能实测、AI 协作说明。

** Alternatives considered:**
- 按组件技术栈组织（信令层、传输层、渲染层）→ 不符合需求文档要求
- 纯功能清单形式 → 缺乏深度，体现不出架构思考过程
- 将 AI 协作混入架构章节 → 需求明确要求独立 AI 协作说明板块

### Decision 2: 架构取舍的叙述角度

**结论**：以"做了什么选择 + 为什么 + 代价是什么"为主线，对应需求文档的"取舍清楚比功能数量重要"原则。

**关键取舍已确认：**
| 选型 | 决定 | 原因 | 代价 |
|---|---|---|---|
| 信令 | 自建 WebSocket 服务器（替代 Firebase） | 国内访问 Firebase 不稳定，阿里云 ECS 可用 | 需要自己维护服务器和心跳 |
| 位置传输 | WebRTC DataChannel P2P | 满足需求"必须走 P2P"约束 | NAT 穿透失败时连接建立失败 |
| 网络拓扑 | Mesh 全互联 | 4 人规模 O(n²) 可接受，无需 SFU | 超过 6 人时连接数爆炸 |
| 位置编码 | Float32Array 8 bytes | JSON 约 50 bytes，8 bytes 省 6x 带宽 | 二进制调试比 JSON 难 |
| 地图 | Leaflet + OSM | 免费、无需 API key、轻量 | 地图覆盖不如 Google Maps |
| 心跳 | DataChannel 心跳 + server-pong | nginx 代理导致客户端 ping 无法到达服务端，故用服务端主动推送 | 增加了服务端复杂度 |

### Decision 3: AI 协作的叙述方式

**结论**：按"工具链 → 任务拆解 → 推翻的方案"结构，实事求是写出 AI 协作过程中的判断，不回避失败。

**AI 推翻记录（待用户补充完整）：**
- 方案 A（Firebase 信令）：因国内访问不稳定被推翻，改用自建 WebSocket
- 方案 B（对称 NAT fallback）：TURN 服务器成本问题，暂不实现，标注为已知风险

## Risks / Trade-offs

[Risk] **README 内容可能过时** → Mitigation：标注文档日期，读者以代码为准
[Risk] **AI 协作记录依赖主观回忆** → Mitigation：基于 git log 和代码注释重建决策时间线
[Risk] **性能数据为理论估算，非实测** → Mitigation：明确标注"理论估算"，待补充实测数据

## Open Questions

- 性能实测数据：当前为理论估算，是否需要补充实际测试数据？
- AI 协作细节：推翻的具体 AI 方案及原因，需要用户补充具体案例
- `存疑.md` 中的问题是否要作为"已知限制"写入 README？