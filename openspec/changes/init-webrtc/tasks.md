## 1. 项目骨架与配置

- [ ] 1.1 创建项目目录结构（index.html / css/ / js/）
- [ ] 1.2 编写 `js/config.js`：WebSocket 信令服务器地址 + 国内 STUN 服务器列表（如腾讯云、网易云信）
- [ ] 1.3 搭建 `index.html`：地图容器、底部成员面板、创建/加入房间按钮
- [ ] 1.4 编写 `css/style.css`：全屏地图布局、底部浮动面板、移动端安全区域适配

## 2. WebSocket 信令层

- [ ] 2.1 部署信令服务器（云服务器/野狗/LeanCloud），或本地开发时启动 WebSocket 服务
- [ ] 2.2 编写 `js/signaling.js`：WebSocket 连接管理，`sendOffer` / `sendAnswer` / `sendIceCandidate` 方法
- [ ] 2.3 实现 `onSignal`：监听服务端推送的 offer/answer/ICE 消息
- [ ] 2.4 实现 `onMembersChange`：监听成员加入/离开事件，更新房间状态
- [ ] 2.5 实现心跳保活：WebSocket ping/pong 机制，断线自动重连
- [ ] 2.6 实现信令清理：WebRTC 连接建立后通知服务端清除对应信令缓存

## 3. WebRTC 单连接

- [ ] 3.1 编写 `js/webrtc.js`：`PeerConnection` 类，封装 `RTCPeerConnection`
- [ ] 3.2 实现 `createOffer`：创建 SDP offer 并写入 Firebase
- [ ] 3.3 实现 `handleOffer` + `sendAnswer`：处理远端 offer，回复 answer
- [ ] 3.4 实现 `addIceCandidate`：处理远端 ICE candidate
- [ ] 3.5 创建 DataChannel（`ordered: true, maxRetransmits: 3`），绑定 `onmessage`
- [ ] 3.6 实现 `onStateChange`：监听连接状态变化，触发重连逻辑

## 4. Mesh 网络拓扑

- [ ] 4.1 编写 `js/mesh.js`：`MeshNetwork` 类，维护 `Map<peerId, PeerConnection>`
- [ ] 4.2 实现 `join`：读取房间现有成员，按 peerId 字典序决定 initiator，依次建联
- [ ] 4.3 实现 `broadcastPosition`：遍历所有 DataChannel 发送编码后的位置数据
- [ ] 4.4 实现心跳：每 5 秒发送 heartbeat，30 秒无响应标记掉线
- [ ] 4.5 实现 `_handleDisconnect`：移除连接，通知 UI 更新成员列表

## 5. 位置编解码

- [ ] 5.1 编写 `js/codec.js`：`encodePosition(lat, lng)` → 8-byte ArrayBuffer（Float32Array）
- [ ] 5.2 实现 `decodePosition(buf)` → `{ lat, lng }`
- [ ] 5.3 （可选）实现 `encodeWithTs(lat, lng, ts)` → 12-byte ArrayBuffer，用于轨迹功能

## 6. GPS 位置获取

- [ ] 6.1 编写 `js/location.js`：`requestLocationPermission` + 权限拒绝错误处理
- [ ] 6.2 实现 `watchPosition(callback)`：调用 `navigator.geolocation.watchPosition`，`enableHighAccuracy: true`
- [ ] 6.3 实现位置更新节流：限制广播频率 ≤ 10Hz（100ms 最小间隔）

## 7. 地图渲染

- [ ] 7.1 编写 `js/map.js`：初始化 Leaflet 地图，加载 OSM 街道图层
- [ ] 7.2 实现 `updateMember(peerId, lat, lng)`：新增或移动 circleMarker
- [ ] 7.3 实现 `removeMember(peerId)`：移除 marker
- [ ] 7.4 实现自身位置标记（不同颜色区分自己与他人）
- [ ] 7.5 新成员加入时调用 `map.setView` 居中到当前所有成员范围

## 8. 房间状态管理

- [ ] 8.1 编写 `js/room.js`：`Room` 类，维护成员列表状态
- [ ] 8.2 实现 `getShareLink`：返回 `<origin>?room=<roomId>`
- [ ] 8.3 实现 `getRoomIdFromURL`：解析 URL `room` 参数
- [ ] 8.4 实现成员列表 UI 更新（显示在线人数和 peerId 前缀）
- [ ] 8.5 实现加入/离开通知：页面内 toast 消息，显示 3 秒后消失

## 9. 主入口集成

- [ ] 9.1 编写 `js/app.js`：`init` 函数，串联所有模块
- [ ] 9.2 实现创建房间流程：生成 roomId → 连接 WebSocket 信令服务器 → 显示分享链接
- [ ] 9.3 实现加入房间流程：解析 URL → 请求定位 → 建立 Mesh 连接
- [ ] 9.4 实现新 peer 加入时立即发送本地当前位置（初始同步）
- [ ] 9.5 绑定所有事件：位置更新 → 广播；peer 加入/离开 → 更新地图和成员列表

## 10. 性能验证与移动端适配

- [ ] 10.1 添加 FPS 监控（`requestAnimationFrame` 计数，控制台输出）
- [ ] 10.2 验证 4 人 10Hz 场景下渲染帧率 ≥ 50fps
- [ ] 10.3 验证新成员加入到首次看到他人位置 ≤ 3 秒
- [ ] 10.4 iOS Safari 15+ 测试：DataChannel 收发、定位权限
- [ ] 10.5 中端安卓测试：地图渲染性能、触摸操作

## 11. 部署与 README

- [ ] 11.1 配置腾讯云 COS 静态网站托管（上传打包后的静态文件，设置索引页和错误页）
- [ ] 11.2 部署 WebSocket 信令服务器（云服务器 cron 后台运行 / 野狗/LeanCloud BaaS）
- [ ] 11.3 验证信令服务器 + 静态站点联调正常，4 人可互通
- [ ] 11.4 编写 README：架构说明、国内技术选型取舍（为什么换掉 Firebase/Google）、性能实测数据、AI 协作说明

## 12. 加分项（可选）

- [ ] 12.1 轨迹绘制：用 Leaflet `polyline` 记录并渲染每个成员的历史路径（最近 50 个点）
- [ ] 12.2 弱网降级：DataChannel 延迟 > 500ms 时自动降低上报频率至 2Hz
