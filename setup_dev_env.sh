#!/bin/bash

# GrainSoccer Director 开发环境设置脚本
# 使用 miniconda 管理 Python 依赖

set -e

echo "🚀 开始设置 GrainSoccer Director 开发环境..."

# 检查是否安装了 miniconda
if ! command -v conda &> /dev/null; then
    echo "❌ 未检测到 conda，请先安装 miniconda"
    echo "请访问: https://docs.conda.io/en/latest/miniconda.html"
    exit 1
fi

echo "✅ 检测到 conda: $(conda --version)"

# 创建 conda 环境
echo "📦 创建 conda 环境 'grainsoccer'..."
conda env create -f environment.yml

# 激活环境
echo "🔧 激活环境..."
conda activate grainsoccer

echo "✅ 开发环境设置完成！"
echo ""
echo "使用方法："
echo "1. 激活环境: conda activate grainsoccer"
echo "2. 运行项目: python server.py"
echo "3. 退出环境: conda deactivate"
echo ""
echo "更新依赖："
echo "conda env update -f environment.yml"
echo ""
echo "删除环境："
echo "conda env remove -n grainsoccer"
