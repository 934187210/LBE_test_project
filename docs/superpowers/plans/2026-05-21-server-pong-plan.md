# 服务端主动心跳实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解决 nginx WebSocket 代理导致心跳失效的问题，通过服务端主动广播 server-pong，客户端 20 秒无消息则重连

**Architecture:** 服务端每 5 秒向所有房间成员广播 `server-pong` 消息；客户端启动定时器检查是否 20 秒无消息，是则主动断开重连。不再依赖客户端发 ping。

**Tech Stack:** Node.js (signaling-server.js), JavaScript (signaling.js)

---

## Task 1: 修改服务端 - 新增 server-pong 广播

**Files:**
- Modify: `server/signaling-server.js` (新增 startServerPongBroadcast 函数)

- [ ] **Step 1: 在 signaling-server.js 中添加 startServerPongBroadcast 函数**

在 `startHeartbeatMonitor` 函数之后添加：

```javascript
/**
 * 服务端主动心跳广播 - 每 5 秒向所有房间成员推送 server-pong
 * 解决 nginx 代理导致客户端 ping 无法到达服务端的问题
 */
function startServerPongBroadcast() {
  setInterval(() => {
    const now = Date.now();
    let totalSent = 0;
    for (const [roomId, room] of rooms.entries()) {
      for (const entry of room) {
        if (entry.ws.readyState === WebSocket.OPEN) {
          try {
            entry.ws.send(JSON.stringify({ type: 'server-pong', ts: now }));
            totalSent++;
          } catch (e) {
            console.error(`[server-pong] 发送失败 ${entry.peerId}: ${e.message}`);
          }
        }
      }
    }
    if (totalSent > 0) {
      console.log(`[server-pong] 广播给 ${totalSent} 个成员`);
    }
  }, 5000); // 每 5 秒
}
```

- [ ] **Step 2: 在服务端启动时调用 startServerPongBroadcast()**

在 `wss.on('connection', ...)` 之后，`startHeartbeatMonitor()` 之前添加：

```javascript
startServerPongBroadcast();
```

- [ ] **Step 3: 确认HEARTBEAT_INTERVAL常量值**

文件顶部已有：
```javascript
const HEARTBEAT_INTERVAL = 5000;   // 客户端每 5s 发一次心跳
const HEARTBEAT_TIMEOUT  = 15000;  // 15s 没收到则视为离线
```

server-pong 广播间隔与 HEARTBEAT_INTERVAL 保持一致（都是 5s）。

- [ ] **Step 4: 上传并重启**

```bash
scp /Users/yuguobin/LBE_test_project/server/signaling-server.js root@114.55.135.92:/opt/locateroom-server/signaling-server.js
ssh root@114.55.135.92 "pm2 restart locateroom-signal && pm2 logs locateroom-signal --nostream --lines 10"
```

预期输出应包含：`[server-pong] 广播给 X 个成员`

---

## Task 2: 修改客户端 - 移除 ping发送，改为20秒无消息检测

**Files:**
- Modify: `js/signaling.js` (_startHeartbeat 和 _handleMessage)

- [ ] **Step 1: 修改 _startHeartbeat，移除客户端发 ping，改为无消息检测**

当前 `_startHeartbeat` 内容替换为：

```javascript
_startHeartbeat() {
    console.log('[信令] _startHeartbeat 启动, 间隔', HEARTBEAT_INTERVAL, 'ms, 20s无消息则重连');
    let lastMsgTime = Date.now();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const elapsed = Date.now() - lastMsgTime;
        if (elapsed > 20000) {
          console.log('[信令] 超过20s未收到服务器消息，主动断开重连 (距上次消息', elapsed, 'ms)');
          this.ws.close();
          return;
        }
        // 不再主动发 ping，服务端会每 5 秒推送 server-pong
        console.log('[信令] 心跳检查, 距上次消息', elapsed, 'ms, 距重连阈值', 20000 - elapsed, 'ms');
      } else {
        console.log('[信令] 心跳检查未执行, ws.readyState=', this.ws?.readyState);
      }
    }, HEARTBEAT_INTERVAL);
    // 保存 lastMsgTime 的引用，供 _handleMessage 使用
    this._lastMsgTime = lastMsgTime;
    // 包装 _handleMessage，每次收到消息更新 lastMsgTime
    const origHandleMessage = this._handleMessage.bind(this);
    this._handleMessage = (msg) => {
      lastMsgTime = Date.now();
      origHandleMessage(msg);
    };
  }
```

- [ ] **Step 2: 修改 _handleMessage，添加 server-pong 处理**

在 switch 语句的 `case 'ice':` 之后添加：

```javascript
case 'server-pong':
  console.log('[Signaling] ← 收到 server-pong');
  break;
```

- [ ] **Step 3: 上传到服务器**

```bash
scp /Users/yuguobin/LBE_test_project/js/signaling.js root@114.55.135.92:/var/www/locateroom/js/
```

---

## Task 3: 验证测试

**Files:**
- 无文件变更，仅测试验证

- [ ] **Step 1: 服务端日志验证**

```bash
ssh root@114.55.135.92 "pm2 logs locateroom-signal --nostream --lines 20"
```

预期：每 5 秒出现 `[server-pong] 广播给 X 个成员`

- [ ] **Step 2: A 刷新页面，创建房间**

浏览器访问 `https://114.55.135.92`，A 创建房间。

- [ ] **Step 3: 观察 A 的浏览器控制台**

Filter 填 `[信令]`，预期每 5 秒出现心跳检查日志，20 秒内无 `server-pong` 收到时出现重连日志。

- [ ] **Step 4: B 加入房间，观察服务端**

```bash
ssh root@114.55.135.92 "pm2 logs locateroom-signal --nostream --lines 50"
```

预期：B 加入后，服务端 `[server-pong] 广播给 2 个成员`

- [ ] **Step 5: 等待 30 秒，确认房间人数仍为 2**

之前会超时的原因是没有收到 pong（nginx 吞了 ping），现在服务端主动发 server-pong，客户端能正常收到并更新 lastMsgTime，不会触发重连。