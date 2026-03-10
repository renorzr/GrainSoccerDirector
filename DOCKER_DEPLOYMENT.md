# Docker 部署指南

本文档说明如何用 Docker / Docker Compose 部署 Grain Soccer Director（Web 版）。

## 前置要求

- Docker 20.10+
- Docker Compose v2+
- 推荐至少 4GB 内存
- 推荐至少 10GB 可用磁盘

## 目录准备

在项目根目录确保以下目录存在（不存在可创建）：

- `games/`（读写，存比赛数据）
- `resources/`（只读，默认素材）
- `fonts/`（只读，字体）

## 环境变量

创建 `.env`：

```env
# OpenAI-compatible text generation
OPENAI_API_KEY=
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen-vl-max-latest

# Fish Audio TTS
FISH_AUDIO_BASE_URL=https://api.fish.audio
FISH_AUDIO_API_KEY=
FISH_AUDIO_MODEL=d8df0ee72d15428891a20aca7f8cd852

# Runtime options (optional)
GAME_DATA_DIR=/app/games
VIDEO_EXTENSIONS=mp4,mov,avi,mkv,webm
```

## 一键部署（推荐）

```bash
docker compose build
docker compose up -d
```

访问：`http://localhost:8000`

查看日志：

```bash
docker compose logs -f
```

## 手动 docker run

```bash
docker build -t soccer-director .

docker run -d \
  --name soccer-director \
  -p 8000:8000 \
  -v $(pwd)/games:/app/games \
  -v $(pwd)/resources:/app/resources:ro \
  -v $(pwd)/fonts:/app/fonts:ro \
  -e OPENAI_API_KEY=your_api_key \
  -e OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 \
  -e OPENAI_MODEL=qwen-vl-max-latest \
  -e FISH_AUDIO_BASE_URL=https://api.fish.audio \
  -e FISH_AUDIO_API_KEY=your_fish_audio_key \
  -e FISH_AUDIO_MODEL=your_fish_audio_model \
  soccer-director
```

## 关键变量说明

| 变量名 | 描述 | 默认值 |
|---|---|---|
| `GAME_DATA_DIR` | 容器内比赛数据目录 | `/app/games` |
| `VIDEO_EXTENSIONS` | 允许上传/处理的视频后缀 | `mp4,mov,avi,mkv,webm` |
| `OPENAI_API_KEY` | OpenAI 兼容接口密钥 | - |
| `OPENAI_BASE_URL` | OpenAI 兼容接口地址 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `OPENAI_MODEL` | 文本模型名 | `qwen-vl-max-latest` |
| `FISH_AUDIO_BASE_URL` | Fish Audio 接口地址 | `https://api.fish.audio` |
| `FISH_AUDIO_API_KEY` | Fish Audio 密钥 | - |
| `FISH_AUDIO_MODEL` | Fish Audio 参考音色模型 ID | - |

## 常用运维命令

```bash
# 查看状态
docker compose ps

# 查看日志
docker compose logs -f soccer-director

# 重启服务
docker compose restart

# 停止并删除容器
docker compose down

# 重新构建并启动
docker compose build --no-cache
docker compose up -d
```

## 故障排查

### 容器启动后健康检查失败

- 执行 `docker compose logs -f soccer-director`
- 检查 8000 端口是否被占用
- 检查 `.env` 中 API 配置是否为空或拼写错误

### 页面可访问但功能报错

- 检查 `OPENAI_*` 是否正确
- 检查 `FISH_AUDIO_*` 是否正确
- 检查挂载目录权限（尤其是 `games/`）

### 视频处理报错

- 检查输入视频格式是否在 `VIDEO_EXTENSIONS`
- 检查磁盘空间

## 生产环境建议

- 在前面加 Nginx/Caddy 反向代理
- 配置 HTTPS
- 限制来源 IP 或加鉴权层
- 对 `games/` 目录做定期备份
