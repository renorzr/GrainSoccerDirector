# 迁移到 Miniconda 指南

本项目已从 pip 依赖管理迁移到 miniconda 环境管理。

## 主要变化

### 新增文件
- `environment.yml` - conda 环境配置文件
- `setup_dev_env.sh` - Linux/Mac 环境设置脚本
- `setup_dev_env.bat` - Windows 环境设置脚本
- `MIGRATION_TO_CONDA.md` - 本迁移指南

### 修改文件
- `Dockerfile` - 更新为使用 conda 环境
- `README.md` - 添加 conda 安装说明

### 保留文件
- `requirements.txt` - 保留用于兼容性

## 迁移步骤

### 对于现有开发者

1. **备份当前环境**（可选）
   ```bash
   pip freeze > requirements_backup.txt
   ```

2. **安装 miniconda**（如果尚未安装）
   - 访问 https://docs.conda.io/en/latest/miniconda.html
   - 下载并安装适合您系统的版本

3. **创建新的 conda 环境**
   ```bash
   conda env create -f environment.yml
   ```

4. **激活新环境**
   ```bash
   conda activate grainsoccer
   ```

5. **验证环境**
   ```bash
   python --version
   pip list
   ```

### 对于新开发者

直接运行环境设置脚本：

**Linux/Mac:**
```bash
./setup_dev_env.sh
```

**Windows:**
```cmd
setup_dev_env.bat
```

## 环境管理命令

```bash
# 激活环境
conda activate grainsoccer

# 退出环境
conda deactivate

# 更新环境
conda env update -f environment.yml

# 删除环境
conda env remove -n grainsoccer

# 查看环境列表
conda env list

# 导出环境
conda env export > environment.yml
```

## 优势

1. **更好的依赖管理** - conda 能更好地处理复杂的依赖关系
2. **跨平台兼容性** - 环境在不同操作系统间更一致
3. **二进制包** - 避免编译问题，安装更快
4. **环境隔离** - 更好的项目环境隔离

## 故障排除

### 常见问题

1. **conda 命令未找到**
   - 确保 miniconda 已正确安装并添加到 PATH

2. **环境创建失败**
   - 检查网络连接
   - 尝试使用国内镜像源

3. **包版本冲突**
   - 使用 `conda env update -f environment.yml` 更新环境
   - 或删除环境重新创建

### 回退到 pip

如果遇到问题，可以回退到 pip 方式：

```bash
# 创建新的虚拟环境
python -m venv venv

# 激活环境
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate     # Windows

# 安装依赖
pip install -r requirements.txt
```

## 支持

如有问题，请提交 Issue 或联系项目维护者。
