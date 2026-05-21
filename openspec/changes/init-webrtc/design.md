## Context

单页 Web 应用，位置数据必须走 WebRTC DataChannel P2P 传输。信令层使用自建 WebSocket 服务器（可选野狗/LeanCloud/云服务器），静态资源部署到阿里云 OSS。目标：4 人房间、10Hz 位置更新、移动端 H5 可用。

## Goals / Non-Goals

**Goals:**
- WebRTC Mesh 全互联，DataChannel 传输位置数据
- 自建 WebSocket 信令服务器（或国内 BaaS），支持 offer/answer/ICE 交换
- 阿里云 OSS 静态网站托管
- 国内 STUN 服务（绕过 Google 服务限制）
- Leaflet 地图实时渲染成员位置
- 断线感知与自动重连

**Non-Goals:**
- SFU/MCU 服务器中转
- 超过 4 人的大房间
- 原生 App（仅 H5）

## Decisions

**D1: Mesh 全互联 vs SFU**
选 Mesh。4 人规模下每人 3 条连接，带宽约 120 bytes × 10Hz × 3 = 3.6KB/s，完全可接受。SFU 需要额外服务器，违背零部署目标。

**D2: WebSocket 信令服务器（国内）**
选自建 WebSocket 信令服务器。原因：Firebase/Google 服务在国内被限，信令无法建立。实现方式三选一：
1. **自购阿里云 ECS**（推荐）：用户已有，约 20-30 元/月，完全可控，直接部署 WebSocket 服务
2. **野狗 Wilddog/LeanCloud**：国内 BaaS，有免费额度，5 分钟内空闲自动休眠，信令场景基本不受影响

WebSocket 服务器仅负责转发 offer/answer/ICE 和房间状态，位置数据不经过服务器。

**D3: 位置编码用 Float32Array（8 bytes/帧）**
选 ArrayBuffer。JSON 约 50 bytes，Float32Array 8 bytes，10Hz × 3 peers = 240 bytes/s，远低于 DataChannel 带宽上限。加时间戳用于轨迹则 12 bytes。

**D4: 原生 JS + Leaflet，不用框架**
选原生 JS。项目规模小，框架引入的包体积和复杂度不值得。Leaflet 50KB，OSM 免费无 API key。

**D5: DataChannel 配置**
`ordered: true, maxRetransmits: 3`。位置数据允许少量丢包，但乱序会导致位置跳变，有序传输更合理。

## Risks / Trade-offs

- **NAT 穿透失败** → 使用国内 STUN 服务（阿里云 NAT/STUN、XiGa Xturn 等），对称 NAT 可能失败。缓解：测试多网络环境；加分项可加国内 TURN 服务。
- **iOS Safari 后台挂起** → 定位停止上报，对方看到位置冻结。缓解：掉线感知（30s 无心跳标记离线）。
- **WebSocket 信令服务器可用性** → 云服务器/BaaS 故障时无法建联。缓解：心跳检测连接状态，断开后尝试重连。
- **Mesh 连接建立顺序冲突** → 多人同时加入时 offer/answer 竞争。缓解：按 peerId 字典序决定 initiator，避免双向同时发 offer。
