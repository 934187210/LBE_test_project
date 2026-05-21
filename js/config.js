/**
 * LocateRoom 配置
 * 信令服务器：阿里云 ECS（国内可访问）
 * STUN 服务器：国内可用
 *
 * 注意：
 * - 移动端使用 GPS（坐标为 WGS84）
 * - 地图底图为高德（坐标为 GCJ-02）
 * - setMyPosition / updateMember 中已有 wgs84ToGcj02 转换
 */

export const SIGNALING_SERVER = 'wss://114.55.135.92/ws';

export const ICE_SERVERS = [
  // 国内可用 STUN 服务器（按可靠性排序）
  { urls: 'stun:stun.stunprotocol.org:3478' },
  { urls: 'stun:stun.xten.com:3478' },
  // 注：stun.l.google.com 在大陆可能被限，可按需启用
  // { urls: 'stun:stun.l.google.com:19302' },
];

export const HEARTBEAT_INTERVAL = 5000;   // ms
export const HEARTBEAT_TIMEOUT  = 30000;  // ms，无响应视为离线（与 spec 保持一致）

export const POSITION_MIN_INTERVAL = 100; // 10Hz，最小广播间隔 ms

export const MY_COLOR = '#4285F4';   // 蓝色，自己的位置
export const PEER_COLOR = '#EA4335'; // 红色，其他成员的位置