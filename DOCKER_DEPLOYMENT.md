# Docker 部署指南

本文档介绍如何使用 Docker 部署谷粒足球导播 (Soccer Director) 应用。

## 前置要求

- Docker 20.10+ 
- Docker Compose 2.0+
- 至少 4GB 可用内存
- 至少 10GB 可用磁盘空间

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd soccer-director
```

### 2. 配置环境变量

创建 `.env` 文件并配置必要的 API 密钥：

```env
# OpenAI API密钥（用于生成解说文字）
OPENAI_API_KEY=your_openai_api_key

# DashScope API密钥（用于语音合成）
DASHSCOPE_API_KEY=your_dashscope_api_key

# fish.audio API密钥（用于语音合成）
FISH_AUDIO_API_KEY=your_fish_audio_api_key
FISH_AUDIO_MODEL=your_fish_audio_model_id
```

### 3. 构建和启动

使用 Docker Compose 一键部署：

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 4. 访问应用

打开浏览器访问：http://localhost:8000

## 手动 Docker 部署

如果不使用 Docker Compose，可以手动构建和运行：

```bash
# 构建镜像
docker build -t soccer-director .

# 运行容器
docker run -d \
  --name soccer-director \
  -p 8000:8000 \
  -v $(pwd)/games:/app/games \
  -v $(pwd)/resources:/app/resources:ro \
  -v $(pwd)/fonts:/app/fonts:ro \
  -e OPENAI_API_KEY=your_api_key \
  -e DASHSCOPE_API_KEY=your_api_key \
  -e FISH_AUDIO_API_KEY=your_api_key \
  -e FISH_AUDIO_MODEL=your_model_id \
  soccer-director
```

## 数据持久化

### 游戏数据

游戏数据存储在 `./games` 目录中，包括：
- 游戏配置文件 (`game.yaml`)
- 视频文件
- 分析结果
- 生成的音频文件

### 资源文件

以下目录会被挂载为只读：
- `./resources` - 包含 logo、记分牌等资源
- `./fonts` - 字体文件

## 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `GAME_DATA_DIR` | 游戏数据目录 | `/app/games` |
| `VIDEO_EXTENSIONS` | 支持的视频格式 | `mp4,mov,avi,mkv` |
| `OPENAI_API_KEY` | OpenAI API 密钥 | - |
| `DASHSCOPE_API_KEY` | DashScope API 密钥 | - |
| `FISH_AUDIO_API_KEY` | Fish Audio API 密钥 | - |
| `FISH_AUDIO_MODEL` | Fish Audio 模型 ID | - |

## 常用命令

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f soccer-director

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新镜像
docker-compose pull
docker-compose up -d

# 进入容器
docker-compose exec soccer-director bash

# 清理未使用的镜像
docker system prune -a
```

## 故障排除

### 1. 容器启动失败

检查日志：
```bash
docker-compose logs soccer-director
```

常见问题：
- 端口 8000 被占用
- 内存不足
- API 密钥配置错误

### 2. 视频处理失败

确保：
- 有足够的磁盘空间
- 视频文件格式正确
- FFmpeg 正常工作

### 3. 前端无法访问

检查：
- 容器是否正常运行
- 端口映射是否正确
- 防火墙设置

### 4. API 调用失败

验证：
- API 密钥是否正确
- 网络连接是否正常
- 服务配额是否充足

## 性能优化

### 1. 资源限制

在 `docker-compose.yml` 中调整资源限制：

```yaml
deploy:
  resources:
    limits:
      memory: 8G
      cpus: '4.0'
    reservations:
      memory: 4G
      cpus: '2.0'
```

### 2. 存储优化

- 使用 SSD 存储
- 定期清理临时文件
- 监控磁盘使用情况

### 3. 网络优化

- 使用本地镜像仓库
- 配置代理（如需要）

## 安全建议

1. **API 密钥安全**
   - 不要在代码中硬编码 API 密钥
   - 使用环境变量或密钥管理服务
   - 定期轮换密钥

2. **网络安全**
   - 配置防火墙规则
   - 使用 HTTPS（生产环境）
   - 限制访问来源

3. **数据安全**
   - 定期备份游戏数据
   - 加密敏感数据
   - 监控访问日志

## 生产环境部署

### 1. 使用反向代理

推荐使用 Nginx 作为反向代理：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. 使用 HTTPS

配置 SSL 证书：

```bash
# 使用 Let's Encrypt
certbot --nginx -d your-domain.com
```

### 3. 监控和日志

- 配置日志收集
- 设置监控告警
- 定期健康检查

## 更新和维护

### 1. 应用更新

```bash
# 拉取最新代码
git pull

# 重新构建镜像
docker-compose build --no-cache

# 重启服务
docker-compose up -d
```

### 2. 数据备份

```bash
# 备份游戏数据
tar -czf games-backup-$(date +%Y%m%d).tar.gz games/

# 恢复数据
tar -xzf games-backup-20240101.tar.gz
```

### 3. 清理维护

```bash
# 清理未使用的容器和镜像
docker system prune -a

# 清理构建缓存
docker builder prune -a
```
