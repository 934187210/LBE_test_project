## Context

LocateRoom 前后端分离架构：
- 前端：静态文件，部署在 nginx `/var/www/locateroom`，通过 HTTPS 对外
- 信令服务器：Node.js WebSocket，端口 8080，通过 nginx `/ws` 反向代理暴露
- 客户端浏览器必须通过 HTTPS 才能使用 WebRTC 和地理定位 API

当前状态：代码已完成，需要部署到阿里云 ECS（IP: 114.55.135.92），让用户通过 HTTPS URL 访问。

## Goals / Non-Goals

**Goals:**
- 通过 HTTPS URL 访问前端页面
- WebSocket 信令通过 WSS（TLS）正常通信
- 信令服务器进程稳定运行（崩溃后自动重启）
- 支持多人房间的信令交换

**Non-Goals:**
- 域名配置（使用 IP 直接访问）
- 免费 TLS 证书（使用自我签名证书，仅限测试）
- CI/CD 自动部署
- HTTPS 证书自动化续期

## Decisions

### 1. nginx + TLS 终止 + WebSocket 反向代理

**选择方案：** nginx 在 443 端口终止 TLS，将 `/ws` 路径的请求代理到后端 8080 端口

**为什么：**
- 不需要在 Node.js 层处理 TLS，简化信令服务器代码
- nginx 处理静态文件服务更高效
- 复用熟悉的 nginx 反向代理模式，配置简单

**替代方案考虑：**
- Node.js 直接处理 HTTPS + WebSocket：需要每个连接都做 TLS 握手，增加信令服务器复杂度
- caddy / apache：nginx 是已安装的选项，配置也熟悉

### 2. 自我签名 SSL 证书（无 Let's Encrypt）

**为什么：**
- 没有域名，无法使用 Let's Encrypt 或其他自动 ACME 流程
- 自签名证书对测试场景足够

**证书信息：**
- CN: 114.55.135.92
- 存放路径: `/etc/nginx/ssl/cert.pem`, `/etc/nginx/ssl/key.pem`
- 浏览器首次访问会显示证书警告，需手动接受

### 3. pm2 管理信令服务器进程

**为什么：**
- systemd 需要编写 service 文件，配置更复杂
- pm2 一行命令即可后台运行，重启自动恢复
- `pm2 logs` 方便调试

**配置：**
- 应用名：`locateroom-signal`
- 启动命令：`node /opt/locateroom-server/signaling-server.js`
- 开机自启：`pm2 startup` + `pm2 save`

### 4. 部署目录 `/var/www/locateroom`

**为什么：**
- nginx 默认或常见静态网站目录，权限和路径清晰
- 与其他可能的 nginx 网站隔离

### 5. 前端 Signaling Server URL 配置

`config.js` 中配置：
```javascript
export const SIGNALING_SERVER = 'wss://114.55.135.92/ws';
```

**为什么用 `wss://` 而非 `ws://`：**
- HTTPS 页面只能连接 WSS 端点（浏览器安全限制）
- nginx 终止 TLS 后以普通 WS 转发给后端

## Risks / Trade-offs

[风险] 自签名证书每次访问需手动接受
→  Mitigation: 告诉用户首次访问时点击"高级"→"继续访问"

[风险] nginx 配置错误导致 WebSocket 代理失败
→  Mitigation: 关键是 `proxy_http_version 1.1` + `Upgrade` + `Connection` 三个 header 必须同时设置

[风险] 信令服务器端口 8080 被防火墙拦截
→  Mitigation: 已确认阿里云安全组规则允许 443 和 8080 入站

[风险] 移动端浏览器定位权限被拒绝
→  Mitigation: 页面显示定位权限引导按钮，引导用户手动授权

## Migration Plan

### 部署步骤

1. **上传信令服务器代码到服务器**
   ```bash
   scp server/signaling-server.js root@114.55.135.92:/opt/locateroom-server/
   ```

2. **安装 Node.js 依赖（如果未安装）**
   ```bash
   ssh root@114.55.135.92 "cd /opt/locateroom-server && npm init -y && npm install ws"
   ```

3. **启动信令服务器**
   ```bash
   ssh root@114.55.135.92 "pm2 start /opt/locateroom-server/signaling-server.js --name locateroom-signal && pm2 save"
   ```

4. **上传前端静态文件**
   ```bash
   scp -r index.html css js root@114.55.135.92:/var/www/locateroom/
   ```

5. **生成自签名证书**
   ```bash
   ssh root@114.55.135.92 "mkdir -p /etc/nginx/ssl && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/nginx/ssl/key.pem -out /etc/nginx/ssl/cert.pem -subj '/CN=114.55.135.92'"
   ```

6. **配置 nginx**
   ```bash
   scp nginx-config root@114.55.135.92:/etc/nginx/sites-available/locateroom
   ssh root@114.55.135.92 "ln -sf /etc/nginx/sites-available/locateroom /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx"
   ```

7. **验证**
   - 浏览器访问 `https://114.55.135.92`，确认页面加载
   - 确认控制台无 TLS/WS 相关错误

### 回滚

如 nginx 配置有问题：
```bash
ssh root@114.55.135.92 "nginx -t && systemctl reload nginx"
```

如信令服务器崩溃：
```bash
ssh root@114.55.135.92 "pm2 list  # 查看状态"
ssh root@114.55.135.92 "pm2 restart locateroom-signal"
```

## Open Questions

- 未来是否需要获取域名并配置 Let's Encrypt？
- 是否需要配置 HTTPS 证书自动续期？
- 是否需要添加 CDN 加速静态资源？