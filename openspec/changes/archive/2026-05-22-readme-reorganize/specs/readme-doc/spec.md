# README Document

## Capability ID

`readme-doc`

## What This Capability Covers

为 LocateRoom 项目编写根目录 `README.md`，包含架构与取舍、性能实测数据和 AI 协作说明三大板块，作为项目主文档。

## Requirements

### REQ-1: 文档结构

README 分为以下章节：

1. **项目简介**（1-2 段话）
2. **架构与取舍**（表格 + 叙述）
3. **性能实测数据**（数字 + 说明）
4. **AI 协作说明**（工具链、任务拆解、推翻的方案）

### REQ-2: 架构与取舍章节

必须覆盖以下选型：

- 信令层：WebSocket 服务器 vs Firebase（实际用 WebSocket）
- 位置传输：WebRTC DataChannel P2P
- 网络拓扑：Mesh 全互联
- 位置编码：Float32Array 8 bytes
- 地图：Leaflet + OSM
- 心跳机制：DataChannel 心跳 + server-pong

每项必须说明：决定是什么、为什么、代价是什么。

### REQ-3: 性能实测数据章节

必须包含：

- 4 人房间、10 Hz 更新下渲染帧率（目标 ≥ 50fps）
- 加入房间到首次看到他人位置的延迟（目标 ≤ 3s）
- 移动端兼容性说明

数据可以是理论估算，但必须标注。

### REQ-4: AI 协作说明章节

必须包含：

- 用了什么 AI 工具（Claude Code、ChatGPT 等）
- 怎么拆任务（并行 agents、Plan 模式等）
- 推翻过哪些 AI 方案及原因（至少 2 个案例）

## Out of Scope

- API 文档
- 部署运维细节
- 代码实现细节