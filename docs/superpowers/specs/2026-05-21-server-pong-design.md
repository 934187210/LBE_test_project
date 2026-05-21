# LocateRoom 服务端主动心跳方案

## 1. Context

LocateRoom 的 WebSocket 信令连接在通过 nginx 反向代理后，客户端发送的 ping 帧无法到达服务端，导致心跳检测失效。客户端 WebSocket 状态正常（readyState=1），但服务端已将其从 rooms 中移除。

根本原因：nginx 的 WebSocket 代理对 ping/pong 帧的处理存在问题，导致心跳无法正常工作。

## 2. Goals / Non-Goals

**Goals:**
- 解决心跳检测失效问题，确保服务端能准确判断客户端在线状态
- 客户端在网络异常时能自动重连
- 不依赖 nginx 的 WebSocket 帧转发行为

**Non-Goals:**
- 不改变现有 nginx 配置（除非方案 C 失败）
- 不开放额外端口（绕过 nginx）
- 不改动 WebRTC 连接逻辑

## 3. Decisions

### 3.1 服务端主动推送心跳

服务端每 5 秒主动向所有连接的客户端广播一个 `server-pong` 消息，不再依赖客户端发送 ping。

**为什么：**
- 客户端发 ping 可能被 nginx 代理层丢失
- 服务端主动推送更可靠，服务端掌控节奏
- 客户端只需检查是否收到消息即可判断连接状态

### 3.2 客户端 20 秒无响应则重连

客户端启动一个定时器，每 5 秒检查：如果超过 20 秒没收到服务端任何消息，主动断开重连。

**为什么：**
- 不需要客户端自己发 ping，减少网络流量
- 20 秒阈值足够容忍网络抖动（服务端每 5 秒发一次）
- 主动重连比等待服务端超时更及时

### 3.3 消息类型

- 服务端 → 客户端：`{ type: 'server-pong' }`（每 5 秒广播）
- 客户端 → 服务端：移除 `ping`，保留 `pong` 响应（兼容性好）
- 其他消息（`created`、`room-members` 等）仍然正常处理

## 4. Data Flow

```
服务端心跳广播（每 5 秒）
  → 遍历 rooms 中所有 peer 的 WebSocket 连接
  → 发送 { type: 'server-pong' }

客户端收到任何消息（包括 server-pong）
  → 更新 lastPongTime

客户端定时器（每 5 秒）
  → 检查 Date.now() - lastPongTime > 20000
  → 超过 20 秒没收到任何消息
  → 关闭 WebSocket，触发 _scheduleReconnect()
```

## 5. Changes

### 服务端（signaling-server.js）

- 新增 `startServerPongBroadcast()` 函数，每 5 秒向所有房间的所有成员广播 `server-pong`
- `startHeartbeatMonitor()` 中的超时检测逻辑保持不变（但依赖 server-pong 触发的时间更新）

### 客户端（signaling.js）

- `_startHeartbeat()`：移除客户端发 ping 的逻辑，改为启动检查定时器（每 5 秒检查是否超过 20 秒无消息）
- `_handleMessage()`：收到任何消息都更新 `lastPongTime`；新增对 `server-pong` 的日志（可选）
- 客户端不再发送 `ping` 消息

## 6. Risks / Trade-offs

[风险] 如果服务端崩溃，客户端会等待 20 秒才发现连接断开
→  Mitigation: 正常情况下服务端稳定运行，20 秒的检测延迟可接受

[风险] 服务端广播 server-pong 时，如果某个 WebSocket 已断开但还在 rooms 中，会发送失败
→  Mitigation: 发送失败时 Node.js 的 ws 库会自动调用 on('error')，不影响其他连接

## 7. Migration Plan

1. 修改服务端：新增 `server-pong` 广播逻辑
2. 修改客户端：移除发 ping 逻辑，改用 20 秒无消息检测
3. 测试：A 创建房间 → 等待 30 秒 → 观察服务端 rooms 状态和客户端连接状态
4. 如果 30 秒后 A 仍在 rooms 中（没有超时离线），说明心跳修复成功

## 8. Open Questions

- 是否需要保留客户端发 ping 的功能作为 fallback？（暂不需要，先用方案 C）
- 是否需要调整 `HEARTBEAT_INTERVAL` 或 `HEARTBEAT_TIMEOUT` 的值？（目前服务端 5s 广播一次，客户端 20s 检测）