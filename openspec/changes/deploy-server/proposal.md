## Why

LocateRoom 需要在阿里云服务器上从开发环境走向生产可访问状态。前端页面通过 HTTPS 对外服务，WebSocket 信令需要通过 TLS 加密（wss）才能在浏览器安全上下文中正常运行。

## What Changes

- **HTTPS 服务**：nginx 在 443 端口提供 TLS，终止 HTTPS 并服务前端静态文件
- **WSS 信令代理**：nginx 将 `/ws` 路径的 WebSocket 连接透传至后端 8080 端口的信令服务器
- **进程管理**：signaling-server 通过 pm2 后台运行，崩溃自动重启
- **自我签名证书**：使用 ip-based 自签名 SSL 证书（无域名）

## Capabilities

### New Capabilities

- `server-deploy`: 阿里云 ECS 上的服务端部署配置，包括 nginx 反向代理、TLS 证书、Node.js 环境、pm2 进程管理

### Modified Capabilities

- （无）

## Impact

- 阿里云 ECS（Ubuntu 22.04）配置变更
- nginx 配置（新增 `/ws` 反向代理）
- 静态文件部署路径：`/var/www/locateroom`
- 信令服务器端口：8080