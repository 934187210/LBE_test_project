/**
 * 房间状态管理
 * 管理成员列表、分享链接、toast 通知
 */

export class Room {
  constructor() {
    this.roomId = null;
    this.myPeerId = null;
    this.members = new Map(); // peerId -> { joinedAt }
  }

  getShareLink() {
    return `${location.origin}${location.pathname}?room=${this.roomId}`;
  }

  static getRoomIdFromURL() {
    const params = new URLSearchParams(location.search);
    return params.get('room');
  }

  setMyId(peerId) { this.myPeerId = peerId; }
  setRoomId(roomId) { this.roomId = roomId; }

  addMember(peerId) {
    if (this.members.has(peerId)) {
      console.warn('[Room] addMember 重复忽略:', peerId);
      return;
    }
    this.members.set(peerId, { joinedAt: Date.now() });
    this._updateUI();
    showToast(`${peerId} 加入了房间`);
  }

  clearMembers() {
    this.members.clear();
    this._updateUI();
  }

  removeMember(peerId) {
    this.members.delete(peerId);
    this._updateUI();
    showToast(`${peerId} 离开了房间`);
  }

  _updateUI() {
    const countEl = document.getElementById('members-count');
    const avatarsEl = document.getElementById('members-avatars');
    if (!countEl || !avatarsEl) return;

    const total = this.members.size + 1; // members 不含自己，所以 +1
    countEl.textContent = `${total} 人在线`;

    // 成员头像 dots
    avatarsEl.innerHTML = '';
    for (const [pid] of this.members) {
      const dot = document.createElement('span');
      dot.className = 'member-dot';
      dot.title = pid;
      avatarsEl.appendChild(dot);
    }
    // 自己的 dot
    const selfDot = document.createElement('span');
    selfDot.className = 'member-dot self';
    selfDot.title = this.myPeerId + ' (我)';
    avatarsEl.appendChild(selfDot);
  }

  updateShareUI() {
    const displayEl = document.getElementById('room-id-display');
    const textEl = document.getElementById('room-id-text');
    if (!displayEl || !textEl) return;
    displayEl.classList.remove('hidden');
    textEl.textContent = this.roomId;
  }
}

let _toastTimer = null;
export function showToast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
  // 重置动画
  el.style.animation = 'none';
  el.offsetHeight; // trigger reflow
  el.style.animation = 'fadeInOut 3s forwards';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}