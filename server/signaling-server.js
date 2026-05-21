/**
 * LocateRoom WebSocket 信令服务器
 * 端口: 8080
 * 仅负责信令转发，不处理任何业务逻辑
 */

const WebSocket = require('ws');

const PORT = 8080;

// 房间数据结构: roomId -> Set of { ws, peerId }
const rooms = new Map();

// 心跳: peerId -> lastHeartbeat
const heartbeats = new Map();

const HEARTBEAT_INTERVAL = 5000;   // 客户端每 5s 发一次心跳
const HEARTBEAT_TIMEOUT  = 15000;  // 15s 没收到则视为离线

const wss = new WebSocket.Server({ port: PORT });

console.log(`[信令服务器] 启动，监听端口 ${PORT}`);

// ─── 广播 ───────────────────────────────────────────────────────────────────

/**
 * 向同房间所有其他成员发送消息（排除 excludeWs）
 */
function broadcast(roomId, message, excludeWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const { ws } of room) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

/**
 * 向指定 peerId 发送消息
 */
function sendTo(peerId, message) {
  for (const room of rooms.values()) {
    for (const entry of room) {
      if (entry.peerId === peerId && entry.ws.readyState === WebSocket.OPEN) {
        entry.ws.send(JSON.stringify(message));
        return;
      }
    }
  }
}

// ─── 房间管理 ────────────────────────────────────────────────────────────────

function addToRoom(ws, roomId, peerId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
    console.log(`[房间] 创建 roomId=${roomId}`);
  }
  rooms.get(roomId).add({ ws, peerId });
  console.log(`[房间] ${peerId} 加入 roomId=${roomId}，当前人数=${rooms.get(roomId).size}`);
}

function removeFromRoom(ws, roomId, peerId) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.forEach(entry => {
    if (entry.ws === ws) entry.ws._closed = true;
  });
  const before = room.size;
  rooms.set(roomId, new Set([...room].filter(e => e.ws !== ws)));
  console.log(`[房间] ${peerId} 离开 roomId=${roomId}，剩余人数=${rooms.get(roomId).size}`);
  if (rooms.get(roomId).size === 0) {
    rooms.delete(roomId);
    console.log(`[房间] roomId=${roomId} 已清空删除`);
  }
}

function getRoomPeerIds(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return [...room].map(e => e.peerId);
}

// ─── 心跳检测 ────────────────────────────────────────────────────────────────

function startHeartbeatMonitor() {
  setInterval(() => {
    const now = Date.now();
    for (const [peerId, lastTs] of heartbeats.entries()) {
      if (now - lastTs > HEARTBEAT_TIMEOUT) {
        heartbeats.delete(peerId);
        // 找到该 peer 所在的房间并广播离线
        for (const [roomId, room] of rooms.entries()) {
          for (const entry of room) {
            if (entry.peerId === peerId) {
              broadcast(roomId, { type: 'member-left', peerId }, entry.ws);
              removeFromRoom(entry.ws, roomId, peerId);
              console.log(`[心跳] ${peerId} 超时离线`);
            }
          }
        }
      }
    }
  }, HEARTBEAT_INTERVAL);
}

// ─── 消息处理 ────────────────────────────────────────────────────────────────

wss.on('connection', (ws) => {
  let currentRoomId = null;
  let currentPeerId = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      // ── 创建房间 ──────────────────────────────────────────────────────────
      case 'create': {
        const { roomId, peerId } = msg;
        if (!roomId || !peerId) return;
        currentRoomId = peerId;        // host 的 peerId 即 roomId
        currentPeerId = peerId;
        addToRoom(ws, currentRoomId, currentPeerId);
        heartbeats.set(currentPeerId, Date.now());
        ws.send(JSON.stringify({ type: 'created', roomId: currentRoomId, peerId: currentPeerId }));
        console.log(`[信令] ${currentPeerId} 创建房间 ${currentRoomId}`);
        break;
      }

      // ── 加入房间 ──────────────────────────────────────────────────────────
      case 'join': {
        const { roomId, peerId } = msg;
        if (!roomId || !peerId) return;
        currentRoomId = roomId;
        currentPeerId = peerId;
        addToRoom(ws, currentRoomId, currentPeerId);
        heartbeats.set(currentPeerId, Date.now());

        // 通知房间内其他成员有人加入
        broadcast(currentRoomId, { type: 'member-joined', peerId }, ws);

        // 告诉新加入者房间里现有的其他成员
        const existingPeers = getRoomPeerIds(currentRoomId).filter(id => id !== currentPeerId);
        ws.send(JSON.stringify({ type: 'room-members', peerIds: existingPeers }));

        console.log(`[信令] ${currentPeerId} 加入房间 ${currentRoomId}，现有成员: ${existingPeers.join(',') || '无'}`);
        break;
      }

      // ── 心跳 ──────────────────────────────────────────────────────────────
      case 'pong': {
        if (currentPeerId) {
          heartbeats.set(currentPeerId, Date.now());
        }
        break;
      }

      // ── 离开 ──────────────────────────────────────────────────────────────
      case 'leave': {
        if (currentRoomId && currentPeerId) {
          broadcast(currentRoomId, { type: 'member-left', peerId: currentPeerId });
          removeFromRoom(ws, currentRoomId, currentPeerId);
          heartbeats.delete(currentPeerId);
        }
        break;
      }

      // ── WebRTC 信令转发 ───────────────────────────────────────────────────
      case 'offer':
      case 'answer':
      case 'ice': {
        const { to } = msg;
        if (!to) return;
        sendTo(to, { ...msg, from: currentPeerId });
        break;
      }

      default:
        break;
    }
  });

  ws.on('close', () => {
    if (currentRoomId && currentPeerId) {
      broadcast(currentRoomId, { type: 'member-left', peerId: currentPeerId });
      removeFromRoom(ws, currentRoomId, currentPeerId);
      heartbeats.delete(currentPeerId);
      console.log(`[信令] ${currentPeerId} WebSocket 断开`);
    }
  });

  ws.on('error', (err) => {
    console.error(`[错误] WebSocket 错误: ${err.message}`);
  });
});

startHeartbeatMonitor();

console.log(`[信令服务器] 运行中，等待连接...`);
