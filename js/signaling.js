/**
 * 前端 WebSocket 信令客户端
 * 负责与信令服务器通信，维护连接状态，转发 offer/answer/ICE
 */

import { SIGNALING_SERVER, HEARTBEAT_INTERVAL } from './config.js';

export class SignalingClient {
  constructor() {
    this.ws = null;
    this.peerId = null;
    this.roomId = null;

    // 回调
    this.onConnected = null;
    this.onDisconnected = null;
    this.onCreated = null;
    this.onRoomMembers = null;
    this.onMembersList = null;
    this.onMemberJoined = null;
    this.onMemberLeft = null;
    this.onOffer = null;
    this.onAnswer = null;
    this.onIceCandidate = null;

    // 重连
    this.reconnectTimer = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;

    // 心跳
    this.heartbeatTimer = null;

    // 防止重复连接
    this._connecting = false;
  }

  // ── 连接 ───────────────────────────────────────────────────────────────────

  connect(peerId) {
    if (this.ws && this.ws.readyState < 2) {
      this._closeSocket(); // 关闭旧连接前先发 leave
    }
    this.peerId = peerId;
    this._connecting = true;

    this.ws = new WebSocket(SIGNALING_SERVER);

    this.ws.onopen = () => {
      this._connecting = false;
      console.log('[信令] WebSocket 已连接');
      this._startHeartbeat();
      if (this.onConnected) this.onConnected();
    };

    this.ws.onmessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      this._handleMessage(msg);
    };

    this.ws.onclose = (event) => {
      this._stopHeartbeat();
      console.log('[信令] WebSocket onclose, code:', event?.code, 'reason:', event?.reason, 'wasClean:', event?.wasClean, 'readyState:', this.ws?.readyState);
      if (this.onDisconnected) this.onDisconnected();
      this._scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[信令] WebSocket 错误', err, 'readyState:', this.ws?.readyState);
    };
  }

  disconnect() {
    this._stopHeartbeat();
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this._closeSocket();
      this.ws = null;
    }
  }

  _closeSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendLeave();
    }
    this.ws.onclose = null; // 阻止触发自动重连
    this.ws.close();
  }

  // ── 发送消息 ───────────────────────────────────────────────────────────────

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  createRoom(roomId) {
    this.roomId = roomId;
    this.send({ type: 'create', roomId, peerId: this.peerId });
  }

  joinRoom(roomId) {
    this.roomId = roomId;
    this.send({ type: 'join', roomId, peerId: this.peerId });
  }

  sendOffer(to, sdp) {
    this.send({ type: 'offer', to, sdp });
  }

  sendAnswer(to, sdp) {
    this.send({ type: 'answer', to, sdp });
  }

  sendIceCandidate(to, candidate) {
    this.send({ type: 'ice', to, candidate });
  }

  sendLeave() {
    this.send({ type: 'leave' });
  }

  // ── 消息分发 ────────────────────────────────────────────────────────────────

  _handleMessage(msg) {
    console.log('[Signaling] ← 收到消息:', JSON.stringify(msg));
    switch (msg.type) {
      case 'created':
        console.log('[Signaling] → onCreated 触发, roomId:', msg.roomId, 'peerId:', msg.peerId);
        if (this.onCreated) this.onCreated(msg.roomId, msg.peerId);
        break;

      case 'room-members':
        console.log('[Signaling] → onRoomMembers 触发, peerIds:', msg.peerIds, '| onMembersList 触发');
        if (this.onMembersList) this.onMembersList(msg.peerIds);
        if (this.onRoomMembers) this.onRoomMembers(msg.peerIds);
        break;

      case 'member-joined':
        console.log('[Signaling] → onMemberJoined 触发, peerId:', msg.peerId);
        if (this.onMemberJoined) this.onMemberJoined(msg.peerId);
        break;

      case 'member-left':
        console.log('[Signaling] → onMemberLeft 触发, peerId:', msg.peerId);
        if (this.onMemberLeft) this.onMemberLeft(msg.peerId);
        break;

      case 'offer':
        console.log('[Signaling] → onOffer 触发, from:', msg.from);
        if (this.onOffer) this.onOffer(msg.from, msg.sdp);
        break;

      case 'answer':
        console.log('[Signaling] → onAnswer 触发, from:', msg.from);
        if (this.onAnswer) this.onAnswer(msg.from, msg.sdp);
        break;

      case 'ice':
        console.log('[Signaling] → onIceCandidate 触发, from:', msg.from);
        if (this.onIceCandidate) this.onIceCandidate(msg.from, msg.candidate);
        break;

      case 'server-pong':
        console.log('[Signaling] ← 收到 server-pong');
        break;

      case 'pong':
        console.log('[Signaling] ← 收到 pong');
        break;
    }
  }

  // ── 心跳 ───────────────────────────────────────────────────────────────────

  _startHeartbeat() {
    if (this.heartbeatTimer) return;
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
    // 包装 _handleMessage，每次收到消息更新 lastMsgTime
    const origHandleMessage = this._handleMessage.bind(this);
    this._handleMessage = (msg) => {
      lastMsgTime = Date.now();
      origHandleMessage(msg);
    };
  }

  _stopHeartbeat() {
    clearInterval(this.heartbeatTimer);
  }

  // ── 重连 ───────────────────────────────────────────────────────────────────

  _scheduleReconnect() {
    if (this._connecting || !this.peerId) return;
    console.log(`[信令] ${this.reconnectDelay}ms 后尝试重连...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.connect(this.peerId);
    }, this.reconnectDelay);
  }
}