# cezhan-v1.3

优化 UI 及逻辑，并新增展品图片支持。

## 项目结构

- `src/`: React + Vite 前端
- `backend/`: FastAPI 后端
- `deploy.sh`: 生产式部署脚本，构建前端并由 FastAPI 统一托管
- `stop.sh`: 停止部署脚本启动的后端服务

## 开发启动

1. 启动后端

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

2. 启动前端

```bash
cd ..
npm install
npm run dev
```

前端开发环境默认通过 Vite 代理把请求转发到 `http://localhost:8000`。

## 生产启动

```bash
./deploy.sh
```

应用启动后默认访问：

- 首页: [http://localhost:8000](http://localhost:8000)
- API 文档: [http://localhost:8000/docs](http://localhost:8000/docs)
