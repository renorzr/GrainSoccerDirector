# 足球导演前端 - React + TypeScript

这是足球导演系统的前端部分，使用 React + TypeScript + Vite 重构。

## 技术栈

- **React 18** - 用户界面库
- **TypeScript** - 类型安全的 JavaScript
- **Vite** - 快速构建工具
- **React Router** - 客户端路由
- **Axios** - HTTP 客户端
- **Lucide React** - 图标库

## 项目结构

```
frontend/
├── public/                 # 静态资源
├── src/
│   ├── components/         # React 组件
│   │   ├── Alert.tsx      # 警告提示组件
│   │   ├── CreateGameModal.tsx  # 创建比赛模态框
│   │   ├── ErrorBoundary.tsx    # 错误边界
│   │   ├── GameDetail.tsx       # 比赛详情页面
│   │   ├── GameDetailPanel.tsx  # 比赛详情面板
│   │   ├── GameDetailTabs.tsx   # 比赛详情标签页
│   │   ├── GameList.tsx         # 比赛列表页面
│   │   ├── Layout.tsx           # 布局组件
│   │   ├── EventsPanel.tsx      # 事件编辑面板
│   │   ├── VideoPanel.tsx       # 视频制作面板
│   │   ├── CommentsPanel.tsx    # 评论编辑面板
│   │   ├── VideosPanel.tsx      # 视频管理面板
│   │   └── VideoPreviewModal.tsx # 视频预览模态框
│   ├── services/          # API 服务
│   │   └── api.ts         # API 客户端
│   ├── types/             # TypeScript 类型定义
│   │   └── index.ts       # 所有类型定义
│   ├── utils/             # 工具函数
│   │   └── index.ts       # 通用工具函数
│   ├── App.tsx            # 主应用组件
│   ├── App.css            # 应用样式
│   ├── main.tsx           # 应用入口
│   └── index.css          # 全局样式
├── index.html             # HTML 模板
├── package.json           # 项目配置
├── tsconfig.json          # TypeScript 配置
├── vite.config.ts         # Vite 配置
└── README.md              # 项目说明
```

## 功能特性

### ✅ 已完成功能

- **比赛管理**
  - 比赛列表展示
  - 创建新比赛
  - 删除比赛
  - 比赛详情查看和编辑

- **比赛详情编辑**
  - 内联编辑模式
  - 队伍信息管理
  - 视频分配
  - 评论要求设置

- **事件管理**
  - 按节数管理事件
  - 添加、编辑、删除事件
  - 事件类型选择
  - 时间排序

- **视频制作**
  - 任务状态监控
  - 启动/取消视频制作
  - 实时状态更新
  - 进度显示

- **评论编辑**
  - 按节数管理评论
  - 编辑评论内容
  - 实时保存

- **视频管理**
  - 视频文件上传
  - 视频列表展示
  - 视频预览
  - 视频删除
  - 链接复制

### 🎨 UI/UX 特性

- **现代化设计**
  - 响应式布局
  - 美观的渐变背景
  - 卡片式设计
  - 流畅的动画效果

- **用户体验**
  - 加载状态指示
  - 错误处理和提示
  - 确认对话框
  - 键盘快捷键支持

- **交互功能**
  - 模态框和弹窗
  - 标签页切换
  - 内联编辑
  - 拖拽上传

## 开发指南

### 环境要求

- Node.js 16+ 
- npm 或 yarn

### 安装依赖

```bash
cd frontend
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
```

### 代码检查

```bash
npm run lint
```

### 预览生产版本

```bash
npm run preview
```

## API 集成

前端通过代理配置连接到后端 API：

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

所有 API 调用都通过 `/api` 前缀，自动代理到后端服务器。

## 类型安全

项目使用 TypeScript 提供完整的类型安全：

- **API 响应类型** - 所有 API 响应都有对应的 TypeScript 接口
- **组件 Props** - 所有组件 props 都有类型定义
- **状态管理** - 使用 TypeScript 管理组件状态
- **工具函数** - 所有工具函数都有类型注解

## 错误处理

- **ErrorBoundary** - 捕获 React 组件错误
- **API 错误处理** - 统一的 API 错误处理机制
- **用户友好的错误提示** - 清晰的错误信息显示

## 性能优化

- **代码分割** - 使用 React.lazy 进行路由级别的代码分割
- **组件优化** - 使用 React.memo 和 useMemo 优化渲染
- **图片优化** - 使用 Vite 的静态资源优化
- **构建优化** - Vite 的快速构建和热更新

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 部署

### 开发环境

```bash
npm run dev
```

### 生产环境

```bash
npm run build
```

构建后的文件在 `dist/` 目录中，可以部署到任何静态文件服务器。

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。