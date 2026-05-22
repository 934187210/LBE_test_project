/**
 * LocateRoom 主入口
 * 串联所有模块，实现创建房间、加入房间、位置共享
 */

import { SignalingClient } from './signaling.js';
import { MeshNetwork } from './mesh.js';
import { MemberMap } from './map.js';
import { Room } from './room.js';
import { requestLocationPermission, watchPosition } from './location.js';

function genPeerId() {
  return Math.random().toString(36).substring(2, 10);
}

class App {
  constructor() {
    this.peerId = genPeerId();
    this.room = new Room();
    this.room.setMyId(this.peerId);
    this.map = new MemberMap('map');
    this.signaling = new SignalingClient();
    this.mesh = null;
    this.positionWatcher = null;
    this._myPosition = null;

    this._bindSignaling();
    this._bindMesh();
    this._bindUI();
    this._initWithGeo();
  }

  _bindSignaling() {
    console.log('[App] _bindSignaling 调用');

    this.signaling.onCreated = (roomId, peerId) => {
      console.log('[App] onCreated 触发, roomId:', roomId, 'peerId:', peerId);
      this.room.setRoomId(roomId);
      // members 不含自己，_updateUI 的 +1 已经代表自己，所以这里不加
      this.room.updateShareUI();
      this.mesh = new MeshNetwork(this.peerId, this.signaling);
      this._bindMeshEvents();
      this.mesh.startHeartbeat();
      setStatus(`房间已创建，等待成员加入...`);
    };

    this.signaling.onRoomMembers = (peerIds) => {
      console.log('[App] onRoomMembers 触发, peerIds:', peerIds);
      // 把房间现有成员加入 members（这些是已在线的成员，不含自己）
      for (const pid of peerIds) {
        console.log('[App] 调用 room.addMember:', pid);
        this.room.addMember(pid);
      }
      if (!this.mesh) { console.log('[App] mesh 不存在，跳过 connectToPeers'); return; }
      console.log('[App] 调用 mesh.connectToPeers, peerIds:', peerIds);
      this.mesh.connectToPeers(peerIds);
    };

    this.signaling.onMembersList = (peerIds) => {
      console.log('[App] onMembersList 触发, peerIds:', peerIds);
      // onMembersList 的 peerIds 是房间现有成员（不含自己）
      // 这些成员通过 onMemberJoined 的广播已经由 mesh 层处理了
      // 这里只需要确保自己的状态正确即可（自己的 peerId 已在 onCreated 时加入）
    };

    this.signaling.onDisconnected = () => {
      console.log('[App] onDisconnected 触发');
      setStatus('信令连接断开，正在重连...');
    };

    console.log('[App] signaling callbacks 已绑定, onCreated:', !!this.signaling.onCreated, 'onRoomMembers:', !!this.signaling.onRoomMembers, 'onMembersList:', !!this.signaling.onMembersList, 'onDisconnected:', !!this.signaling.onDisconnected);
  }

  _bindMesh() {
    // Mesh 由 onCreated / onRoomMembers 动态创建后绑定到 _bindMeshEvents()
  }

  _bindMeshEvents() {
    console.log('[App] _bindMeshEvents 被调用, mesh:', !!this.mesh);
    if (!this.mesh) return;
    console.log('[App] 绑定 mesh 回调, onPeerJoined:', !!this.mesh.onPeerJoined, 'onPeerLeft:', !!this.mesh.onPeerLeft);
    this.mesh.onPeerJoined = (peerId) => {
      console.log('[App] mesh.onPeerJoined 触发, peerId:', peerId);
      console.log('[App] 调用 room.addMember:', peerId);
      this.room.addMember(peerId);
      // 立即发送当前位置给对方（初始同步）
      if (this._myPosition) {
        setTimeout(() => {
          console.log('[App] broadcastPosition to', peerId);
          this.mesh.broadcastPosition(this._myPosition.lat, this._myPosition.lng);
        }, 500);
      }
    };
    this.mesh.onPeerLeft = (peerId) => {
      console.log('[App] mesh.onPeerLeft 触发, peerId:', peerId, '调用 room.removeMember');
      this.room.removeMember(peerId);
      this.map.removeMember(peerId);
    };
    this.mesh.onPositionUpdate = (peerId, lat, lng) => {
      console.log('[App] mesh.onPositionUpdate, peerId:', peerId, 'lat:', lat, 'lng:', lng);
      this.map.updateMember(peerId, lat, lng);
    };
    this.mesh.onConnectionReady = (peerId) => {
      console.log(`[App] 与 ${peerId} 连接就绪`);
      // 连接建立后立即发当前位置
      if (this._myPosition) {
        this.mesh.broadcastPosition(this._myPosition.lat, this._myPosition.lng);
      }
    };
  }

  _bindUI() {
    document.getElementById('create-room-btn').onclick = () => this._createRoom();
    document.getElementById('join-room-btn').onclick = () => this._joinRoom();
    document.getElementById('copy-link-btn').onclick = () => this._copyShareLink();
  }

  _init() {
    const urlRoomId = Room.getRoomIdFromURL();
    if (urlRoomId) {
      document.getElementById('join-room-btn').classList.remove('hidden');
      document.getElementById('create-room-btn').textContent = `创建新房`;
      setStatus(`检测到分享链接，是否加入房间？`);
    } else {
      setStatus('点击「创建房间」开始');
    }
  }

  _showGeoRetryButton() {
    setStatus('需要定位权限才能使用');
    const btn = document.createElement('button');
    btn.textContent = '授予定位权限';
    btn.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#4285F4;color:#fff;border:none;border-radius:8px;padding:14px 24px;font-size:16px;cursor:pointer;z-index:9999;';
    btn.onclick = () => {
      btn.remove();
      // 直接调用浏览器 API，不经过 async 函数，确保是用户点击直接触发
      navigator.geolocation.getCurrentPosition(
        pos => {
          const result = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          this._myPosition = result;
          this.map.setMyPosition(result.lat, result.lng);
          hideLoading();
          this._init();
        },
        err => {
          hideLoading();
          if (err.code === 1) {
            setStatus('定位权限被拒绝，请到浏览器设置中开启');
          } else {
            setStatus(`定位失败: ${err.message}`);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };
    document.body.appendChild(btn);
  }

  async _initWithGeo() {
    showLoading('正在获取定位...');
    console.log('[App] 开始请求定位');
    try {
      console.log('[App] 调用 requestLocationPermission()');
      const pos = await requestLocationPermission();
      console.log('[App] 收到位置:', JSON.stringify(pos));
      this._myPosition = pos;
      this.map.setMyPosition(pos.lat, pos.lng);
      hideLoading();
      this._init();
    } catch (e) {
      console.error('[App] 定位异常:', e);
      hideLoading();
      if (e.message.includes('拒绝') || e.message.includes('denied') || e.code === 1) {
        this._showGeoRetryButton();
      } else {
        setStatus(`定位失败: ${e.message}`);
      }
    }
  }

  _createRoom() {
    console.log('[App] _createRoom 被调用');
    const roomId = genPeerId();
    console.log('[App] 生成的 roomId:', roomId, 'this.peerId:', this.peerId);
    // 重置状态（旧房间成员、本地 mesh）
    if (this.mesh) { this.mesh.destroy(); this.mesh = null; }
    this.room.clearMembers();
    this.signaling.connect(this.peerId);
    this.signaling.onConnected = () => {
      console.log('[App] onConnected 触发, 调用 createRoom:', roomId);
      this.signaling.createRoom(roomId);
      this._startLocationSharing();
    };
  }

  _joinRoom() {
    console.log('[App] _joinRoom 被调用');
    const roomId = Room.getRoomIdFromURL();
    console.log('[App] URL roomId:', roomId, 'this.peerId:', this.peerId);
    if (!roomId) { setStatus('房间号无效'); return; }
    this.signaling.connect(this.peerId);
    this.signaling.onConnected = () => {
      console.log('[App] onConnected 触发, 调用 joinRoom:', roomId);
      this.signaling.joinRoom(roomId);
      this.room.setRoomId(roomId);
      this.mesh = new MeshNetwork(this.peerId, this.signaling);
      this._bindMeshEvents();
      this.mesh.startHeartbeat();
      setStatus(`已加入房间 ${roomId}`);
      this._startLocationSharing();
    };
  }

  _copyShareLink() {
    const link = this.room.getShareLink();

    // 尝试使用 Web Share API（移动端推荐）
    if (navigator.share) {
      navigator.share({ text: link }).then(() => {
        showToast('分享链接已分享');
      }).catch(() => {
        // 用户取消分享，使用降级方案
        this._fallbackCopy(link);
      });
      return;
    }

    // 降级方案：创建临时 input 用 execCommand 复制
    this._fallbackCopy(link);
  }

  _fallbackCopy(text) {
    const input = document.createElement('input');
    input.value = text;
    input.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
    document.body.appendChild(input);
    input.focus();
    input.select();
    try {
      document.execCommand('copy');
      showToast('分享链接已复制');
    } catch {
      // 完全不支持复制时，弹出输入框让用户手动复制
      prompt('复制分享链接：', text);
    } finally {
      input.remove();
    }
  }

  _startLocationSharing() {
    this.positionWatcher = watchPosition(pos => {
      this._myPosition = pos;
      this.map.setMyPosition(pos.lat, pos.lng);
      if (this.mesh) {
        this.mesh.broadcastPosition(pos.lat, pos.lng);
      }
    });
  }
}

// ── 辅助函数 ────────────────────────────────────────────────────────────────

function setStatus(msg) {
  const el = document.getElementById('status-text');
  if (el) el.textContent = msg;
}

function showLoading(msg = '加载中...') {
  const el = document.getElementById('loading');
  const text = document.getElementById('loading-text');
  if (el) el.classList.remove('hidden');
  if (text) text.textContent = msg;
}

function hideLoading() {
  const el = document.getElementById('loading');
  if (el) el.classList.add('hidden');
}

// ── FPS 监控 ────────────────────────────────────────────────────────────────

let _fpsFrameCount = 0;
let _fpsLastTime = performance.now();
function _monitorFPS() {
  _fpsFrameCount++;
  const now = performance.now();
  if (now - _fpsLastTime >= 1000) {
    console.log(`[FPS] ${_fpsFrameCount}`);
    _fpsFrameCount = 0;
    _fpsLastTime = now;
  }
  requestAnimationFrame(_monitorFPS);
}
requestAnimationFrame(_monitorFPS);

// ── 启动 ────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  window._app = new App();
});