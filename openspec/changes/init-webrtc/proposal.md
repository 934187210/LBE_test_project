## Why

构建一个基于 WebRTC DataChannel P2P 的实时位置共享房间应用，让多人可以通过分享链接加入同一房间，在地图上互相实时看到对方位置。项目需要在 48 小时内完成，核心约束是位置数据必须走 P2P 传输而非服务器中转。

## What Changes

- 新增 WebRTC Mesh 网络模块，支持 4 人全互联拓扑
- 新增 Firebase Realtime DB 信令通道，用于 WebRTC 建联（不传位置数据）
- 新增 GPS 位置获取与 10Hz 上报机制
- 新增 Leaflet 地图渲染，实时显示所有成员位置
- 新增房间管理：创建/加入/成员列表/断线感知

## Capabilities

### New Capabilities
- `webrtc-mesh`: WebRTC Mesh 全互联拓扑，DataChannel P2P 位置传输，心跳检测与断线恢复
- `websocket-signaling`: 自建 WebSocket 信令服务器，管理 offer/answer/ICE candidate 交换及房间元数据
- `location-sharing`: GPS 位置获取（10Hz）、ArrayBuffer 编解码压缩、位置广播
- `room-management`: 房间创建/加入（URL 分享）、在线成员列表、加入/离开通知

### Modified Capabilities

## Impact

- **依赖**: Firebase JS SDK、Leaflet、Google 公开 STUN 服务
- **平台**: 移动端 H5（中端安卓 + iOS Safari 15+）
- **性能底线**: 4 人 10Hz 下 ≥50fps，首次看到他人位置 ≤3s
- **部署**: Firebase Hosting（静态站点，零服务器）
