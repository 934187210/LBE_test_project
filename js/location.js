/**
 * GPS 位置获取
 * 处理权限申请、位置监听、10Hz 节流
 */

import { POSITION_MIN_INTERVAL } from './config.js';

export async function requestLocationPermission() {
  if (!navigator.geolocation) {
    throw new Error('浏览器不支持定位');
  }
  // 先触发浏览器权限弹窗（iOS Safari 必须在用户交互后调用）
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        console.log('[定位] 成功回调进入');
        const result = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        console.log('[定位] 即将 resolve:', JSON.stringify(result));
        resolve(result);
      },
      err => {
        console.error('[定位] 错误完整对象:', err);
        console.error('[定位] err.code:', err.code, 'typeof:', typeof err.code);
        console.error('[定位] err.message:', err.message);
        if (err.code === 1) {
          reject(new Error('定位权限被拒绝，请开启浏览器定位权限'));
        } else {
          reject(new Error(err.message || '定位失败'));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export function watchPosition(callback) {
  let lastTime = 0;

  return navigator.geolocation.watchPosition(
    pos => {
      const now = Date.now();
      if (now - lastTime < POSITION_MIN_INTERVAL) return;
      lastTime = now;
      callback({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    },
    err => console.error('[定位] GPS 错误:', err.message),
    { enableHighAccuracy: true }
  );
}