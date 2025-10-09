# 多阶段构建 Dockerfile for Soccer Director
# 第一阶段：构建前端
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# 复制前端依赖文件
COPY frontend/package*.json ./

# 安装前端依赖（包括开发依赖，因为构建需要 TypeScript）
RUN npm ci

# 复制前端源代码
COPY frontend/ ./

# 构建前端
RUN npm run build

# 第二阶段：Python 后端
FROM continuumio/miniconda3:25.3.1-1

# 设置工作目录
WORKDIR /app

# 安装系统依赖
COPY debian.sources /etc/apt/sources.list.d/debian.sources

RUN apt-get update && apt-get install -y \
    ffmpeg \
    x264 \
    libx264-dev \
    libgl1-mesa-dri \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    libgstreamer1.0-0 \
    libgstreamer-plugins-base1.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制 conda 环境文件
COPY environment.yml .

# 创建并激活 conda 环境
RUN conda env create -f environment.yml
RUN conda clean -afy

# 复制后端源代码
COPY *.py ./
COPY resources/ ./resources/
COPY fonts/ ./fonts/

# 从第一阶段复制构建好的前端文件
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 创建游戏数据目录
RUN mkdir -p /app/games

# 设置环境变量
ENV GAME_DATA_DIR=/app/games
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
CMD curl -f http://localhost:8000/api || exit 1

# 激活环境并启动命令
SHELL ["conda", "run", "-n", "grainsoccer", "/bin/bash", "-c"]
CMD ["conda", "run", "-n", "grainsoccer", "python", "server.py"]
