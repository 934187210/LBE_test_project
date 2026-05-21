/**
 * 位置数据编解码 — Float32Array，8 bytes/帧
 */

export function encodePosition(lat, lng) {
  const buf = new ArrayBuffer(8);
  const view = new Float32Array(buf);
  view[0] = lat;
  view[1] = lng;
  return buf;
}

export function decodePosition(buf) {
  const view = new Float32Array(buf);
  return { lat: view[0], lng: view[1] };
}

export function encodeWithTs(lat, lng, ts) {
  const buf = new ArrayBuffer(12);
  const view = new Float32Array(buf);
  view[0] = lat;
  view[1] = lng;
  view[2] = ts;  // Unix ms 时间戳
  return buf;
}

export function decodeWithTs(buf) {
  const view = new Float32Array(buf);
  return { lat: view[0], lng: view[1], ts: view[2] };
}

export function encodeHeartbeat() {
  return new TextEncoder().encode(JSON.stringify({ type: 'heartbeat' }));
}