# XR智能策展助手 V1.8 开发版

在 V1.7 策展流程基础上增加展厅预览。完整大纲页会按已确认的单元和展品生成可浏览的概念展厅；展墙长度随展品数量变化。在支持 WebXR 的设备上可进入沉浸式 VR 预览，其他设备使用普通三维预览。概念展厅不代表真实场地尺寸。原有 AI 接口和项目数据结构保持不变。

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

### 无后端预览展厅

检查项目内的预览流程时，运行 `npm install` 和 `npm run dev`，打开 `http://localhost:5173/gallery-demo.html`，在“我的项目”的已完成卡片上点击“展厅预览”。该页面使用示例项目数据，不会写入数据库；正式功能从已保存项目读取单元、展品和策展文本。实际入口位于已完成项目卡片和“完整大纲”页。沉浸式 VR 入口需要支持 WebXR 的浏览器和设备；本地开发可使用 localhost，正式部署需 HTTPS。

## 生产启动

```bash
./deploy.sh
```

应用启动后默认访问：

- 首页: [http://localhost:8000](http://localhost:8000)
- API 文档: [http://localhost:8000/docs](http://localhost:8000/docs)
