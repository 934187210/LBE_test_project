/**
 * Leaflet 地图渲染
 * 实时显示所有成员位置
 *
 * 图源说明：
 * - 中国大陆 OSM tile 被 GFW 屏蔽，故替换为高德瓦片（GCJ-02 坐标系）
 * - GPS 坐标为 WGS84，需要转换为 GCJ-02 才能正确叠加在高德地图上
 * - 偏移量约 300-600m，不转换时标记会漂移
 */

import { MY_COLOR, PEER_COLOR } from './config.js';

// ── GCJ-02 坐标转换（WGS84 → 高德/腾讯地图坐标系）────────────
// 算法来源：coordtransform npm / https://github.com/autonomynorth/tscoord
function wgs84ToGcj02(wgsLat, wgsLng) {
  const PI = 3.1415926535897932384626;
  const a  = 6378245.0;
  const ee = 0.00669342162296594323;

  if (wgsLng < 72.004 || wgsLng > 137.8347 || wgsLat < 0.8293 || wgsLat > 55.827) {
    return [wgsLat, wgsLng];
  }

  let dlat = _transformLat(wgsLng - 105.0, wgsLat - 35.0);
  let dlng = _transformLng(wgsLng - 105.0, wgsLat - 35.0);
  const radlat = wgsLat / 180.0 * PI;
  let magic = Math.sin(radlat);
  magic = 1 - ee * magic * magic;
  const sqrtmagic = Math.sqrt(magic);

  // 纬度偏移：_transformLat 返回的是弧度，乘以 180/PI 并用子午线曲率半径归一化
  dlat = (dlat * 180.0) / ((a * (1 - ee)) / (magic * sqrtmagic) * PI);
  // 经度偏移：用卯酉圈曲率半径归一化
  dlng = (dlng * 180.0) / (a / sqrtmagic * Math.cos(radlat) * PI);

  return [wgsLat + dlat, wgsLng + dlng];
}

function _transformLat(x, y) {
  const PI = 3.1415926535897932384626;
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320.0 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function _transformLng(x, y) {
  const PI = 3.1415926535897932384626;
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) / 3.0;
  return ret;
}

export class MemberMap {
  constructor(containerId) {
    this.map = L.map(containerId, {
      zoomControl: false,
      attributionControl: true,
    }).setView([39.9, 116.4], 15);

    // 高德瓦片（GD）— 中国大陆可访问，坐标系为 GCJ-02
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      subdomains: '1234',
      attribution: '© 高德地图',
      maxZoom: 19,
    }).addTo(this.map);

    this.markers = new Map(); // peerId -> { marker, latlng }
    this.trails = new Map();  // peerId -> [latlng array] (加分项)

    this.myMarker = null;
  }

  // 设置自己的位置（蓝色标记）
  setMyPosition(lat, lng) {
    const [gcjLat, gcjLng] = wgs84ToGcj02(lat, lng);
    if (this.myMarker) {
      this.myMarker.setLatLng([gcjLat, gcjLng]);
    } else {
      this.myMarker = L.circleMarker([gcjLat, gcjLng], {
        radius: 9,
        color: '#fff',
        fillColor: MY_COLOR,
        fillOpacity: 1,
        weight: 2,
      }).addTo(this.map);
      this.myMarker.bindTooltip('我', { permanent: true, className: 'peer-label' });
      this.map.setView([gcjLat, gcjLng], 15);
    }
  }

  // 添加或更新成员位置（红色标记）
  updateMember(peerId, lat, lng) {
    const [gcjLat, gcjLng] = wgs84ToGcj02(lat, lng);
    if (this.markers.has(peerId)) {
      this.markers.get(peerId).marker.setLatLng([gcjLat, gcjLng]);
      this.markers.get(peerId).latlng = { lat: gcjLat, lng: gcjLng };
    } else {
      const marker = L.circleMarker([gcjLat, gcjLng], {
        radius: 7,
        color: '#fff',
        fillColor: PEER_COLOR,
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(this.map);
      marker.bindTooltip(peerId.substring(0, 8), { className: 'peer-label' });
      this.markers.set(peerId, { marker, latlng: { lat: gcjLat, lng: gcjLng } });
    }
  }

  // 移除掉线成员
  removeMember(peerId) {
    const entry = this.markers.get(peerId);
    if (entry) {
      entry.marker.remove();
      this.markers.delete(peerId);
    }
  }

  // 轨迹绘制（加分项接口）
  pushTrailPoint(peerId, lat, lng) {
    if (!this.trails.has(peerId)) {
      this.trails.set(peerId, []);
    }
    const trail = this.trails.get(peerId);
    const [gcjLat, gcjLng] = wgs84ToGcj02(lat, lng);
    trail.push([gcjLat, gcjLng]);
    if (trail.length > 50) trail.shift();
  }

  clearAll() {
    if (this.myMarker) { this.myMarker.remove(); this.myMarker = null; }
    for (const { marker } of this.markers.values()) marker.remove();
    this.markers.clear();
    this.trails.clear();
  }
}