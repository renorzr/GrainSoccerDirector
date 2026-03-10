# 谷粒足球导播 (Grain Soccer Director)

一个面向足球视频制作的 Web 应用：上传比赛素材、编辑事件与解说、生成分段视频与最终成片。

## 核心能力

- 比赛管理：创建比赛、编辑比赛信息、管理多节比赛配置
- 事件编辑：按节维护事件时间线并保存
- 解说生成：基于事件分析生成解说文本，并支持手动修改
- 视频制作：生成分节视频、最终整场视频、视频拼接与裁剪
- 素材管理：上传、预览、重命名、删除比赛视频素材

## 技术架构

- 后端：FastAPI (`server.py`)
- 前端：React + TypeScript + Vite (`frontend/`)
- 多媒体处理：FFmpeg
- 文本模型：OpenAI 兼容接口（默认使用 qwen 模型）
- 语音合成：Fish Audio API

## 快速开始（本地开发）

### 1) 准备依赖

- Python 3.11（推荐使用 conda）
- Node.js 18+
- FFmpeg（系统可执行）

### 2) 克隆项目

```bash
git clone https://github.com/renorzr/soccer-director.git
cd soccer-director
```

### 3) 安装 Python 依赖

使用 conda（推荐）：

```bash
conda env create -f environment.yml
conda activate grainsoccer
```

或使用 venv + pip：

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 4) 安装并构建前端

```bash
cd frontend
npm ci
npm run build
cd ..
```

### 5) 配置环境变量

复制示例文件并编辑：

```bash
cp .example.env .env
```

`.env` 示例（默认值与当前代码一致）：

```env
# OpenAI-compatible text generation
OPENAI_API_KEY=
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen-vl-max-latest

# Fish Audio TTS
FISH_AUDIO_BASE_URL=https://api.fish.audio
FISH_AUDIO_API_KEY=
FISH_AUDIO_MODEL=

# Runtime options (optional)
GAME_DATA_DIR=./games
VIDEO_EXTENSIONS=mp4,mov,avi,mkv,webm
```

### 6) 启动服务

```bash
python server.py
```

浏览器访问：`http://localhost:8000`

## Docker 部署

使用 Docker Compose：

```bash
docker compose build
docker compose up -d
```

访问：`http://localhost:8000`

详细说明见 `DOCKER_DEPLOYMENT.md`。

## 使用流程（Web）

1. 在首页创建比赛
2. 上传比赛视频素材
3. 在“事件编辑”中维护事件时间轴
4. 在“解说管理”中生成并调整解说文本
5. 在“视频生成”中生成分段视频或最终成片
6. 在“视频管理”中预览、拼接、裁剪和导出

## 目录说明

- `server.py`：FastAPI 服务入口
- `frontend/`：前端项目源码
- `games/`：比赛数据目录（运行后生成）
- `resources/`：默认素材（记分牌、品牌片头等）
- `fonts/`：字体资源
- `ai.py`：文本模型调用（OpenAI 兼容）
- `voicer.py`：语音合成调用（Fish Audio）

## 常见问题

### 前端页面打不开或空白

- 先确认已执行 `frontend` 下的 `npm run build`
- 再确认后端日志中不存在静态文件路径错误

### 模型调用失败

- 检查 `OPENAI_API_KEY` 是否已配置
- 检查 `OPENAI_BASE_URL` 与 `OPENAI_MODEL` 是否匹配目标服务

### 语音生成失败

- 检查 `FISH_AUDIO_API_KEY` 与 `FISH_AUDIO_MODEL`
- 检查网络是否可以访问 `FISH_AUDIO_BASE_URL`

### 视频处理失败

- 确认 FFmpeg 可用
- 确认磁盘空间充足，输入视频格式在 `VIDEO_EXTENSIONS` 列表中

## 安全建议

- 不要提交 `.env` 到版本库
- 定期轮换 API 密钥
- 生产环境建议配合反向代理与 HTTPS

## 许可证

Apache License 2.0
