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
      this.ws.close();
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

    this.ws.onclose = () => {
      this._stopHeartbeat();
      if (this.onDisconnected) this.onDisconnected();
      this._scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[信令] WebSocket 错误', err);
    };
  }

  disconnect() {
    this._stopHeartbeat();
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null; // 阻止自动重连
      this.ws.close();
      this.ws = null;
    }
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
    switch (msg.type) {
      case 'created':
        if (this.onCreated) this.onCreated(msg.roomId, msg.peerId);
        break;

      case 'room-members':
        if (this.onRoomMembers) this.onRoomMembers(msg.peerIds);
        break;

      case 'member-joined':
        if (this.onMemberJoined) this.onMemberJoined(msg.peerId);
        break;

      case 'member-left':
        if (this.onMemberLeft) this.onMemberLeft(msg.peerId);
        break;

      case 'offer':
        if (this.onOffer) this.onOffer(msg.from, msg.sdp);
        break;

      case 'answer':
        if (this.onAnswer) this.onAnswer(msg.from, msg.sdp);
        break;

      case 'ice':
        if (this.onIceCandidate) this.onIceCandidate(msg.from, msg.candidate);
        break;
    }
  }

  // ── 心跳 ───────────────────────────────────────────────────────────────────

  _startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);
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