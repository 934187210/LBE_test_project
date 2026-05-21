/**
 * 单个 WebRTC P2P 连接
 * 管理一个 peer 的 RTCPeerConnection 和 DataChannel
 */

import { ICE_SERVERS } from './config.js';
import { encodePosition, decodePosition } from './codec.js';

export class PeerConnection {
  constructor(peerId, isInitiator, signaling) {
    this.peerId = peerId;
    this.isInitiator = isInitiator;
    this.signaling = signaling;
    this.pc = null;
    this.dc = null;

    this.onMessage = null;
    this.onStateChange = null;
    this.onDataChannelOpen = null;

    this._setupConnection();
  }

  _setupConnection() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        this.signaling.sendIceCandidate(this.peerId, evt.candidate);
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.onStateChange) this.onStateChange(this.peerId, this.pc.connectionState);
      if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'disconnected') {
        // 触发断开处理
      }
    };

    // 接收方：等待对方创建 DataChannel
    this.pc.ondatachannel = (evt) => {
      this._setupDataChannel(evt.channel);
    };

    // 发起方：主动创建 DataChannel
    if (this.isInitiator) {
      this._createDataChannel();
    }
  }

  _createDataChannel() {
    const label = `locateroom-${this.peerId}`;
    this.dc = this.pc.createDataChannel(label, { ordered: true, maxRetransmits: 3 });
    this._bindDataChannel(this.dc);
  }

  _setupDataChannel(channel) {
    this.dc = channel;
    this._bindDataChannel(channel);
  }

  _bindDataChannel(dc) {
    dc.onopen = () => {
      console.log(`[WebRTC] DataChannel open: ${this.peerId}`);
      if (this.onDataChannelOpen) this.onDataChannelOpen(this.peerId);
    };
    dc.onclose = () => {
      console.log(`[WebRTC] DataChannel closed: ${this.peerId}`);
    };
    dc.onmessage = (evt) => {
      if (this.onMessage) {
        try {
          // 位置数据：ArrayBuffer → 解码
          if (evt.data instanceof ArrayBuffer) {
            const pos = decodePosition(evt.data);
            this.onMessage(this.peerId, pos);
          } else {
            // 其他消息（心跳等）
            console.log(`[DataChannel] ${this.peerId}:`, evt.data);
          }
        } catch (e) {
          console.error('[DataChannel] 解码错误', e);
        }
      }
    };
  }

  // ── 发送位置 ───────────────────────────────────────────────────────────────

  sendPosition(lat, lng) {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(encodePosition(lat, lng));
    }
  }

  sendRaw(data) {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(data);
    }
  }

  // ── Offer / Answer ─────────────────────────────────────────────────────────

  async createOffer() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.signaling.sendOffer(this.peerId, offer);
  }

  async handleOffer(sdp) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    // 收到 offer 后自动创建 answer + DataChannel
    this._createDataChannel();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.signaling.sendAnswer(this.peerId, answer);
  }

  async handleAnswer(sdp) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  async addIceCandidate(candidate) {
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('[WebRTC] addIceCandidate 失败', e);
    }
  }

  close() {
    if (this.dc) { this.dc.close(); this.dc = null; }
    if (this.pc) { this.pc.close(); this.pc = null; }
  }
}