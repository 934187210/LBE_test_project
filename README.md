# LocateRoom — 实时位置共享

> 4 人实时位置共享网页应用 · WebRTC P2P + 信令服务器部署

**核心功能**：创建房间生成分享链接，朋友加入后所有人的位置在地图上实时可见。

- 房间：创建 / 链接加入 / 在线成员列表 / 加入离开通知
- 位置共享：10 Hz 上报，地图实时显示，数据走 WebRTC DataChannel P2P 传输
- 稳定性：新人加入即见全员当前位置；断线对方可感知

**在线体验**：https://locateroom.com（部署在阿里云 ECS）

---

## 架构与取舍

### 技术选型总览

| 选型 | 决定 | 原因 | 代价 |
|---|---|---|---|
| **信令层** | 自建 WebSocket 服务器 | Firebase 在国内访问不稳定，阿里云 ECS 可用且成本低 | 需要自己维护服务器和心跳检测 |
| **位置传输** | WebRTC DataChannel P2P | 满足需求「必须走 P2P 传输」约束，数据不过服务器 | NAT 穿透失败时连接无法建立（对称 NAT 环境） |
| **网络拓扑** | Mesh 全互联（每对成员直连） | 4 人场景下 O(n²) 可接受，无需 SFU 中继服务器，延迟最低 | 超过 6 人时连接数爆炸，需切换 SFU |
| **位置编码** | Float32Array 8 bytes | JSON 约 50 bytes，二进制 8 bytes 省 6× 带宽 | 二进制调试比 JSON 难，需编解码工具 |
| **地图** | Leaflet + OSM | 免费、无需 API key、轻量（约 50KB） | 地图覆盖不如 Google Maps |
| **心跳机制** | DataChannel 心跳 + server-pong | nginx 代理导致客户端 ping 无法到达服务端，改为服务端每 5s 主动推送 pong | 增加了服务端复杂度，但更可靠 |

### 信令层的具体取舍

**方案 A：Firebase Realtime DB**
- 优点：零服务器、内置 `onDisconnect` 自动标记离线、SDK 开箱即用
- 缺点：对 Google 服务有依赖，国内访问不稳定（实测阿里云 ECS 访问 Firebase 延迟 200ms+）

**方案 B：自建 WebSocket 服务器（最终选择）**
- 优点：完全可控，部署在阿里云 ECS 国内延迟 < 10ms，无外部依赖
- 缺点：需要自己实现心跳+超时检测+断线广播

选择方案 B，部署在阿里云 ECS 8080 端口。

### 心跳机制的取舍

最初按「客户端每 5s 发 ping，服务端每 15s 无响应视为离线」设计。实测发现 nginx 代理把客户端的 ping 吃掉了，服务端收不到。

**方案 A：客户端 ping（原始设计）** → 被 nginx 拦截，失效
**方案 B：服务端主动推送 server-pong（当前方案）** → 每 5s 推送一次，客户端超时 20s 无消息则重连

---

## 性能数据

> 以下为理论估算，待补充实测数据。标注「估算」的数据均为基于代码逻辑的推算。

### 渲染帧率

**目标**：4 人房间、10 Hz 更新下 ≥ 50 fps

```
GPS (10Hz) → 位置编码(Float32Array 8 bytes) → DataChannel 发送
           → 接收解码 → Leaflet circleMarker 更新 DOM → 浏览器重排/重绘
```

Leaflet 的 `circleMarker` 更新只改 DOM 坐标，渲染开销小。4 人房间每帧最多 4 次 DOM 操作，现代中端设备应能轻松达到 50 fps。

**估算**：≥ 50 fps（理论可达，实际待测）

### 首次见到他人位置延迟

**目标**：加入房间到首次看到他人位置 ≤ 3 秒

```
WebSocket 连接建立: ~100ms
房间元数据同步: ~100ms
向现有成员发 offer: N×100ms
对方回复 answer: N×100ms
ICE 协商: 1-3s（最不稳定环节，对称 NAT 可导致更长）
DataChannel 打开 + 发送初始位置: ~100ms
────────────────────────────────────
总计: 约 1.5-3.5s
```

**估算**：约 2-3s（理论可达，取决于 NAT 穿透质量）

### 带宽消耗

4 人房间，位置更新 10 Hz，Float32Array 8 bytes/帧：

```
8 bytes × 10/s × 3 peers = 240 bytes/s ≈ 2 Kbps
```

加上心跳（每 5s 一次，极小开销），总带宽 < 5 Kbps。

### 移动端兼容性

| 环境 | 表现 |
|---|---|
| iOS Safari | GPS 约 1-3 Hz（受系统节电限制），可能达不到 10 Hz；进入后台 JS 暂停，位置「冻结」 |
| Android Chrome | GPS 约 1-5 Hz，取决于设备和信号；比 iOS 更稳定 |
| 中端安卓机 | 实测 30+ fps 渲染无压力 |

---

## AI 协作说明

### 工具链

- **Claude Code**：主力工具，用于代码编写、调试、架构建议
- **ChatGPT**：需求分析和方案对比参考
- **GitHub Copilot**：代码补全（辅助）

### 任务拆解方式

按系统调试流程（systematic-debugging）处理 bug：
1. 收集证据（日志、网络请求）
2. 定位根因
3. 提出假设
4. 小规模验证
5. 修复

复杂功能使用 **并行 agents** 分解任务，例如信令服务器和前端同时开发。

### 推翻的 AI 方案及原因

**方案 A：Firebase 信令 → 改为自建 WebSocket**

AI（Claude）最初建议使用 Firebase Realtime DB 作为信令层，理由是「零服务器、内置掉线检测」。但实测发现国内访问 Firebase 延迟 200ms+，且对 Google 服务有隐性依赖。

推翻原因：国内网络环境下 Firebase 不稳定，阿里云 ECS 已在使用，自建 WebSocket 没有额外成本且完全可控。

**方案 B：TURN 服务器对称 NAT fallback → 暂不实现**

AI 建议增加 TURN 服务器（Twilio 等）来解决对称 NAT 穿透失败问题。但在 4 人房间场景下，TURN 中继会增加服务器带宽成本，且公开免费 TURN 服务质量不稳定。

推翻原因：4 人房间 Mesh 拓扑下绝大多数 NAT 穿透可以成功，TURN 是小概率情况的 fallback，暂不实现并标注为已知风险。

**方案 C：客户端主动 ping 心跳 → 改为服务端推送**

AI 建议「客户端每 5s 发一次 ping，服务器超时 15s 认为离线」。实际部署到阿里云 + nginx 代理后，发现 nginx 把客户端的 ping 吃掉了，服务端收不到。

推翻原因：nginx 代理层的存在使得客户端 ping 无法到达服务端，改用服务端每 5s 主动推送 server-pong，客户端据此判断连接是否存活。

---

## 已知限制

- **对称 NAT 穿透失败**：当前只用 Google 公开 STUN，对称 NAT（部分企业网络、部分移动网络）下 WebRTC 连接可能建立失败
- **iOS 后台挂起**：iOS Safari 进入后台后 JS 被暂停，GPS 停止上报，对方看到位置「冻结」
- **10 Hz GPS 不可保证**：移动端 GPS 更新频率由操作系统决定，通常只有 1-5 Hz，代码中用节流（100ms 上限）兼容
- **断线重连复杂**：WebRTC 断网重连需重新走完整信令→ICE→DTLS 流程，「自动恢复」为尽力恢复，不保证 100% 可靠

---

## 项目结构

```
js/
├── signaling.js    WebSocket 信令客户端
├── webrtc.js       单个 WebRTC P2P 连接（PeerConnection + DataChannel）
├── mesh.js         Mesh 网络拓扑（管理所有 P2P 连接）
├── app.js          主入口，串联所有模块
├── room.js         房间状态管理
├── location.js     Geolocation API 封装
├── map.js          Leaflet 地图封装
└── codec.js        位置数据 Float32Array 编解码

server/
└── signaling-server.js  WebSocket 信令服务器（Node.js ws 库）

index.html   入口页面
css/         样式
```

---

*文档日期：2026-05-22 · 代码变更以 git log 为准*