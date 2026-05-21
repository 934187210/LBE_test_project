/**
 * Mesh 网络拓扑
 * 管理所有 P2P 连接，处理位置广播、成员变化、断线
 */

import { PeerConnection } from './webrtc.js';
import { HEARTBEAT_INTERVAL, HEARTBEAT_TIMEOUT } from './config.js';

export class MeshNetwork {
  constructor(myPeerId, signaling) {
    this.myPeerId = myPeerId;
    this.signaling = signaling;
    this.connections = new Map(); // peerId -> PeerConnection

    // 心跳追踪（DataChannel 层面）
    this.lastHeartbeat = new Map(); // peerId -> timestamp

    this.heartbeatTimer = null;

    this.onPeerJoined = null;
    this.onPeerLeft = null;
    this.onPositionUpdate = null;
    this.onConnectionReady = null;

    this._setupSignalingCallbacks();
  }

  _setupSignalingCallbacks() {
    this.signaling.onOffer = (from, sdp) => this._handleOffer(from, sdp);
    this.signaling.onAnswer = (from, sdp) => this._handleAnswer(from, sdp);
    this.signaling.onIceCandidate = (from, candidate) => this._handleIceCandidate(from, candidate);
    this.signaling.onMemberJoined = (peerId) => this._handleMemberJoined(peerId);
    this.signaling.onMemberLeft = (peerId) => this._handleMemberLeft(peerId);
  }

  // ── 加入房间（收到服务器推送的房间成员列表后调用）──────────────

  async connectToPeers(peerIds) {
    for (const remotePeerId of peerIds) {
      // 字典序：我更小 → 我发起；否则等对方发起
      if (this.myPeerId < remotePeerId) {
        const pc = this._createPeerConnection(remotePeerId, true);
        await pc.createOffer();
      }
      // 若对方更小，我们会在 onOffer 里处理
    }
  }

  // ── 成员变化 ────────────────────────────────────────────────────────────

  async _handleMemberJoined(peerId) {
    console.log('[Mesh] _handleMemberJoined 被调用, peerId:', peerId, 'connections已有:', this.connections.has(peerId));
    if (this.connections.has(peerId)) return;
    console.log('[Mesh] _handleMemberJoined → 调用 onPeerJoined');
    if (this.onPeerJoined) this.onPeerJoined(peerId);
  }

  _handleMemberLeft(peerId) {
    const pc = this.connections.get(peerId);
    if (pc) {
      pc.close();
      this.connections.delete(peerId);
      this.lastHeartbeat.delete(peerId);
    }
    if (this.onPeerLeft) this.onPeerLeft(peerId);
  }

  // ── WebRTC 信令处理 ─────────────────────────────────────────────────────

  async _handleOffer(from, sdp) {
    if (!this.connections.has(from)) {
      this._createPeerConnection(from, false);
    }
    await this.connections.get(from).handleOffer(sdp);
  }

  async _handleAnswer(from, sdp) {
    const pc = this.connections.get(from);
    if (pc) await pc.handleAnswer(sdp);
  }

  async _handleIceCandidate(from, candidate) {
    const pc = this.connections.get(from);
    if (pc) await pc.addIceCandidate(candidate);
  }

  // ── 创建 P2P 连接 ───────────────────────────────────────────────────────

  _createPeerConnection(peerId, isInitiator) {
    if (this.connections.has(peerId)) {
      this.connections.get(peerId).close();
    }
    const pc = new PeerConnection(peerId, isInitiator, this.signaling);

    pc.onMessage = (from, pos) => {
      this.lastHeartbeat.set(from, Date.now());
      if (this.onPositionUpdate) this.onPositionUpdate(from, pos.lat, pos.lng);
    };

    pc.onDataChannelOpen = (from) => {
      this.lastHeartbeat.set(from, Date.now());
      if (this.onConnectionReady) this.onConnectionReady(from);
    };

    pc.onStateChange = (peerId, state) => {
      console.log(`[Mesh] ${peerId} 连接状态: ${state}`);
    };

    this.connections.set(peerId, pc);
    return pc;
  }

  // ── 位置广播 ─────────────────────────────────────────────────────────────

  broadcastPosition(lat, lng) {
    for (const [, pc] of this.connections) {
      pc.sendPosition(lat, lng);
    }
  }

  // ── 心跳检测（DataChannel 层面）─────────────────────────────────────────

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const [peerId, lastTs] of this.lastHeartbeat.entries()) {
        if (now - lastTs > HEARTBEAT_TIMEOUT) {
          console.warn(`[Mesh] ${peerId} DataChannel 心跳超时`);
          this._handleMemberLeft(peerId);
        }
      }
      // 发送心跳（空消息即可，DataChannel 有就足够）
      for (const [, pc] of this.connections) {
        if (pc.dc && pc.dc.readyState === 'open') {
          try { pc.dc.send('ping'); } catch {}
        }
      }
    }, HEARTBEAT_INTERVAL);
  }

  stopHeartbeat() {
    clearInterval(this.heartbeatTimer);
  }

  // ── 关闭所有连接 ────────────────────────────────────────────────────────

  destroy() {
    this.stopHeartbeat();
    for (const [, pc] of this.connections) pc.close();
    this.connections.clear();
  }
}