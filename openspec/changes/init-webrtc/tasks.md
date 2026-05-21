## 1. 项目骨架与配置

- [x] 1.1 创建项目目录结构（index.html / css/ / js/）
- [x] 1.2 编写 `js/config.js`：WebSocket 信令服务器地址（阿里云 ECS 公网IP:8080）+ 国内 STUN 服务器列表
- [x] 1.3 搭建 `index.html`：地图容器、底部成员面板、创建/加入房间按钮
- [x] 1.4 编写 `css/style.css`：全屏地图布局、底部浮动面板、移动端安全区域适配

## 2. 信令服务器（Node.js WebSocket）

- [x] 2.1 编写 `server/signaling-server.js`：Node.js + ws 库实现 WebSocket 服务器
- [x] 2.2 实现房间注册：`create` 消息创建房间，记录 roomId → [peerIds] 映射
- [x] 2.3 实现消息转发：`offer` / `answer` / `ice` 消息按 `to` 字段转发给目标 peer
- [x] 2.4 实现成员感知：`join` 消息加入房间，`leave` 消息退出房间；广播 `member-joined` / `member-left` 给同房间其他成员
- [x] 2.5 实现心跳检测：服务端记录每个连接的最后心跳时间，60s 无心跳视为离线并广播 `member-left`
- [ ] 2.6 本地测试：本地启动服务器，打开两个浏览器 tab 验证 join/offer/answer 互通

## 3. 前端 WebSocket 信令层

- [x] 3.1 编写 `js/signaling.js`：WebSocket 连接管理，`connect` / `send` / `close` 方法
- [x] 3.2 实现 `onSignal`：监听服务端推送的 offer/answer/ICE 消息，回调给 MeshNetwork
- [x] 3.3 实现 `onMembersChange`：监听 `member-joined` / `member-left` 事件
- [x] 3.4 实现心跳保活：客户端每 5 秒向服务器发 ping，30 秒无响应触发断线重连
- [x] 3.5 实现断线重连：WebSocket close 后指数退避重连（1s → 2s → 4s → 8s → 上限 30s）

## 4. WebRTC 单连接

- [x] 4.1 编写 `js/webrtc.js`：`PeerConnection` 类，封装 `RTCPeerConnection`
- [x] 4.2 实现 `createOffer`：创建 SDP offer 并通过 WebSocket 信令服务器发送给目标 peer
- [x] 4.3 实现 `handleOffer` + `sendAnswer`：处理远端 offer，回复 answer
- [x] 4.4 实现 `addIceCandidate`：处理远端 ICE candidate
- [x] 4.5 创建 DataChannel（`ordered: true, maxRetransmits: 3`），绑定 `onmessage`
- [x] 4.6 实现 `onStateChange`：监听连接状态变化，触发重连逻辑

## 5. Mesh 网络拓扑

- [x] 5.1 编写 `js/mesh.js`：`MeshNetwork` 类，维护 `Map<peerId, PeerConnection>`
- [x] 5.2 实现 `join`：读取房间现有成员，按 peerId 字典序决定 initiator，依次建联
- [x] 5.3 实现 `broadcastPosition`：遍历所有 DataChannel 发送编码后的位置数据
- [x] 5.4 实现心跳：每 5 秒发送 DataChannel heartbeat，30 秒无响应标记掉线
- [x] 5.5 实现 `_handleDisconnect`：移除连接，通知 UI 更新成员列表

## 6. 位置编解码

- [x] 6.1 编写 `js/codec.js`：`encodePosition(lat, lng)` → 8-byte ArrayBuffer（Float32Array）
- [x] 6.2 实现 `decodePosition(buf)` → `{ lat, lng }`
- [x] 6.3 （可选）实现 `encodeWithTs(lat, lng, ts)` → 12-byte ArrayBuffer，用于轨迹功能

## 7. GPS 位置获取

- [x] 7.1 编写 `js/location.js`：`requestLocationPermission` + 权限拒绝错误处理
- [x] 7.2 实现 `watchPosition(callback)`：调用 `navigator.geolocation.watchPosition`，`enableHighAccuracy: true`
- [x] 7.3 实现位置更新节流：限制广播频率 ≤ 10Hz（100ms 最小间隔）

## 8. 地图渲染

- [x] 8.1 编写 `js/map.js`：初始化 Leaflet 地图，加载高德瓦片（含 WGS84→GCJ02 坐标转换）
- [x] 8.2 实现 `updateMember(peerId, lat, lng)`：新增或移动 circleMarker
- [x] 8.3 实现 `removeMember(peerId)`：移除 marker
- [x] 8.4 实现自身位置标记（不同颜色区分自己与他人）
- [x] 8.5 新成员加入时调用 `map.setView` 居中到当前所有成员范围

## 9. 房间状态管理

- [x] 9.1 编写 `js/room.js`：`Room` 类，维护成员列表状态
- [x] 9.2 实现 `getShareLink`：返回 `<origin>?room=<roomId>`
- [x] 9.3 实现 `getRoomIdFromURL`：解析 URL `room` 参数
- [x] 9.4 实现成员列表 UI 更新（显示在线人数和 peerId 前缀）
- [x] 9.5 实现加入/离开通知：页面内 toast 消息，显示 3 秒后消失

## 10. 主入口集成

- [x] 10.1 编写 `js/app.js`：`init` 函数，串联所有模块
- [x] 10.2 实现创建房间流程：生成 roomId → 连接 WebSocket 信令服务器 → 显示分享链接
- [x] 10.3 实现加入房间流程：解析 URL → 请求定位 → 建立 Mesh 连接
- [x] 10.4 实现新 peer 加入时立即发送本地当前位置（初始同步）
- [x] 10.5 绑定所有事件：位置更新 → 广播；peer 加入/离开 → 更新地图和成员列表

## 11. 性能验证与移动端适配

- [x] 11.1 添加 FPS 监控（`requestAnimationFrame` 计数，控制台输出）
- [ ] 11.2 验证 4 人 10Hz 场景下渲染帧率 ≥ 50fps
- [ ] 11.3 验证新成员加入到首次看到他人位置 ≤ 3 秒
- [ ] 11.4 iOS Safari 15+ 测试：DataChannel 收发、定位权限
- [ ] 11.5 中端安卓测试：地图渲染性能、触摸操作

## 12. 部署与 README

- [x] 12.1 将 `server/signaling-server.js` 上传到阿里云 ECS（具体操作见下方「服务器操作步骤」）
- [x] 12.2 在 ECS 上安装 Node.js（若未安装）和 ws 依赖，启动信令服务器并用 systemd 或 pm2 保持后台运行
- [ ] 12.3 配置阿里云 OSS 静态网站托管（上传打包后的静态文件到 OSS Bucket，设置静态网站索引页，绑定自定义域名）
- [ ] 12.4 验证信令服务器 + 静态站点联调正常：4 台设备打开分享链接，全部互通
- [ ] 12.5 编写 README：架构说明、技术选型取舍、性能实测数据、AI 协作说明

## 13. 加分项（可选）

- [ ] 13.1 轨迹绘制：用 Leaflet `polyline` 记录并渲染每个成员的历史路径（最近 50 个点）
- [ ] 13.2 弱网降级：DataChannel 延迟 > 500ms 时自动降低上报频率至 2Hz