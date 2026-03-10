# Grain Soccer Director Frontend

前端基于 React + TypeScript + Vite，提供比赛管理、事件编辑、解说管理和视频管理界面。

## 技术栈

- React 18
- TypeScript
- Vite 5
- React Router
- Axios
- Lucide React

## 开发环境要求

- Node.js 18+
- npm 9+

## 安装依赖

```bash
npm ci
```

## 本地开发

```bash
npm run dev
```

默认地址：`http://localhost:3000`

开发服务器通过 Vite 代理将 `/api` 转发到 `http://localhost:8000`。

## 生产构建

```bash
npm run build
```

构建产物输出到 `frontend/dist/`，由后端 `server.py` 作为静态文件提供。

## 预览构建结果

```bash
npm run preview
```

## 代码检查

```bash
npm run lint
```

## 与后端联调

1. 在项目根目录启动后端：`python server.py`
2. 在 `frontend/` 启动前端：`npm run dev`
3. 打开 `http://localhost:3000`

## 目录结构（核心）

- `src/components/`：页面与业务组件
- `src/services/api.ts`：HTTP API 封装
- `src/types/`：类型定义
- `src/utils/`：工具函数
- `src/main.tsx`：应用入口

## 常见问题

### 页面接口请求失败

- 确认后端已在 `8000` 端口运行
- 检查浏览器 Network 中 `/api` 请求状态码

### 生产环境页面空白

- 确认已执行 `npm run build`
- 确认后端可访问 `frontend/dist/index.html`
