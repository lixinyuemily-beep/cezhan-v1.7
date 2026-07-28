# 部署与并发配置

## Docker 服务

仓库已包含生产部署所需文件：

- `Dockerfile`：前端构建与 nginx 静态服务
- `backend/Dockerfile`：FastAPI 后端镜像
- `docker-compose.yml`：backend / web / caddy 编排
- `deploy/nginx.conf`：前端容器内反向代理配置
- `deploy/Caddyfile`：公网 HTTPS 入口

## 并发设置

v1.6 针对多人同时生成做了以下调整：

- 后端默认使用 2 个 Uvicorn worker。
- AI 请求会在线程中执行，避免长时间 DeepSeek 调用阻塞 FastAPI 事件循环。
- 每个 worker 默认最多同时发起 3 个 AI 请求，2 个 worker 下整体约 5-6 个 AI 并发。
- AI 请求默认最多等待队列 60 秒，单次 DeepSeek 调用超时 240 秒。

可通过环境变量调整：

```bash
AI_MAX_CONCURRENT_REQUESTS=3
AI_QUEUE_WAIT_TIMEOUT_SECONDS=60
AI_REQUEST_TIMEOUT_SECONDS=240
AI_DEBUG_LOG_PROMPTS=false
```

如果要严格控制“全站总共最多 5 个 AI 请求”，需要引入 Redis / 数据库任务队列做全局限流；当前版本是轻量服务器上更简单的近似方案。
