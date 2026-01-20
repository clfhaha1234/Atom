#!/bin/bash
# 运行沙盒测试的便捷脚本

set -e

echo "🧪 运行 Daytona 沙盒测试"
echo ""

# 检查 Python 环境
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 python3"
    exit 1
fi

# 检查是否安装了依赖
if ! python3 -c "import daytona" 2>/dev/null; then
    echo "⚠️  警告: daytona 包未安装"
    echo "   正在安装依赖..."
    pip install daytona==0.21.8 structlog==25.4.0
fi

# 检查环境变量
if [ -z "$DAYTONA_API_KEY" ]; then
    echo "⚠️  警告: DAYTONA_API_KEY 环境变量未设置"
    echo "   尝试从 .env 文件加载..."
    
    if [ -f "../.env" ]; then
        export $(cat ../.env | grep DAYTONA | xargs)
    fi
    
    if [ -z "$DAYTONA_API_KEY" ]; then
        echo "❌ 错误: 无法找到 DAYTONA_API_KEY"
        echo "   请设置环境变量或确保 backend/.env 文件存在"
        exit 1
    fi
fi

echo "✅ 环境检查通过"
echo ""

# 运行 Python 测试
cd "$(dirname "$0")"
python3 test_daytona.py
