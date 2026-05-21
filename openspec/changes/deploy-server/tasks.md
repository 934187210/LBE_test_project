## 1. Server Environment Setup

- [x] 1.1 确认阿里云 ECS SSH 连接（114.55.135.92）
- [x] 1.2 确认 Ubuntu 22.04 已安装 nodejs 和 npm
- [x] 1.3 确认阿里云安全组允许 22（SSH）、443（HTTPS）、8080（WebSocket）入站

## 2. Signaling Server Deployment

- [x] 2.1 创建服务器目录 `/opt/locateroom-server/`
- [x] 2.2 上传 `server/signaling-server.js` 到服务器
- [x] 2.3 服务器端执行 `npm init -y && npm install ws`
- [x] 2.4 使用 pm2 启动 signaling-server：`pm2 start /opt/locateroom-server/signaling-server.js --name locateroom-signal`
- [x] 2.5 配置 pm2 开机自启：`pm2 save && pm2 startup`

## 3. nginx HTTPS + WebSocket Proxy

- [x] 3.1 创建 SSL 证书目录 `/etc/nginx/ssl/`
- [x] 3.2 生成自签名证书：`openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/nginx/ssl/key.pem -out /etc/nginx/ssl/cert.pem -subj '/CN=114.55.135.92'`
- [x] 3.3 编写 nginx 配置文件 `/etc/nginx/sites-available/locateroom`（443端口，SSL 证书，静态文件根目录 `/var/www/locateroom`，`/ws` 反向代理到 `127.0.0.1:8080`）
- [x] 3.4 启用配置：`ln -sf /etc/nginx/sites-available/locateroom /etc/nginx/sites-enabled/`
- [x] 3.5 测试配置：`nginx -t`
- [x] 3.6 重载 nginx：`systemctl reload nginx`

## 4. Front-end Static File Deployment

- [x] 4.1 创建部署目录 `/var/www/locateroom/`
- [x] 4.2 上传 `index.html`、`css/`、`js/` 到服务器部署目录
- [x] 4.3 确认 `js/config.js` 中 `SIGNALING_SERVER = 'wss://114.55.135.92/ws'`

## 5. Verification

- [ ] 5.1 浏览器访问 `https://114.55.135.92` 确认页面加载（接受证书警告）
- [ ] 5.2 浏览器控制台确认无 TLS/WebSocket 连接错误
- [ ] 5.3 测试创建房间 + 加入房间，信令交换正常
- [ ] 5.4 确认 pm2 日志显示信令服务器运行中：`pm2 logs locateroom-signal`

## 6. Known Issues

- [ ] 6.1 房间成员在线人数显示不一致（排查中，已加调试日志）
- [ ] 6.2 移动端使用 IP 访问时地理定位权限提示（正常，需要 HTTPS）