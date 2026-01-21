#!/bin/bash

# 仅测试构建（不启动服务器）
# 用法: ./scripts/test-render-build-only.sh

set -e

echo "=========================================="
echo "🔄 模拟 Render 构建过程（仅构建）"
echo "=========================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

cd "$(dirname "$0")/.."
ROOT_DIR=$(pwd)

echo ""
echo "📂 项目根目录: $ROOT_DIR"

# 清理
echo ""
echo "==> 清理旧的构建产物..."
rm -rf backend/dist
rm -rf frontend/dist

# 检查 Node.js
echo ""
echo "==> Node.js: $(node --version), npm: $(npm --version)"

# 构建
echo ""
echo "==> 运行: npm install && npm run build"
echo ""

time (npm install && npm run build)

# 验证
echo ""
echo "=========================================="
echo "构建结果验证"
echo "=========================================="

if [ -d "frontend/dist" ] && [ -d "backend/dist" ]; then
    echo -e "${GREEN}✅ 构建成功！${NC}"
    echo ""
    echo "frontend/dist:"
    du -sh frontend/dist
    echo ""
    echo "backend/dist:"
    du -sh backend/dist
    ls backend/dist/*.js 2>/dev/null | head -5
else
    echo -e "${RED}❌ 构建失败${NC}"
    [ ! -d "frontend/dist" ] && echo "  - frontend/dist 缺失"
    [ ! -d "backend/dist" ] && echo "  - backend/dist 缺失"
    exit 1
fi

echo ""
echo "=========================================="
echo "🎉 Render 构建模拟完成"
echo "=========================================="
