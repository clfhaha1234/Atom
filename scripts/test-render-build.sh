#!/bin/bash

# 模拟 Render 部署环境的本地测试脚本
# 用法: ./scripts/test-render-build.sh

set -e  # 遇到错误立即退出

echo "=========================================="
echo "🔄 模拟 Render 部署环境"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 切换到项目根目录
cd "$(dirname "$0")/.."
ROOT_DIR=$(pwd)

echo ""
echo "📂 项目根目录: $ROOT_DIR"
echo ""

# 步骤 1: 清理构建产物（模拟全新部署）
echo "==> Step 1: 清理构建产物..."
rm -rf backend/dist
rm -rf frontend/dist
echo -e "${GREEN}✓ 清理完成${NC}"

# 可选：完全清理 node_modules（模拟首次部署）
if [ "$1" == "--clean" ]; then
    echo "==> 清理 node_modules (--clean 模式)..."
    rm -rf node_modules
    rm -rf backend/node_modules
    rm -rf frontend/node_modules
    echo -e "${GREEN}✓ node_modules 已清理${NC}"
fi

# 步骤 2: 显示 Node.js 版本
echo ""
echo "==> Step 2: 检查 Node.js 版本..."
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"

# 检查版本要求
NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ 需要 Node.js >= 18.0.0${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js 版本符合要求${NC}"

# 步骤 3: 运行 npm install（与 Render 相同）
echo ""
echo "==> Step 3: 运行 'npm install && npm run build'..."
echo ""

echo "--- npm install ---"
npm install
echo -e "${GREEN}✓ npm install 完成${NC}"

# 步骤 4: 运行 build
echo ""
echo "--- npm run build ---"
npm run build

echo ""
echo -e "${GREEN}✓ npm run build 完成${NC}"

# 步骤 5: 验证构建产物
echo ""
echo "==> Step 4: 验证构建产物..."

if [ -d "frontend/dist" ]; then
    echo -e "${GREEN}✓ frontend/dist 存在${NC}"
    ls -la frontend/dist/
else
    echo -e "${RED}❌ frontend/dist 不存在${NC}"
    exit 1
fi

echo ""

if [ -d "backend/dist" ]; then
    echo -e "${GREEN}✓ backend/dist 存在${NC}"
    ls -la backend/dist/
else
    echo -e "${RED}❌ backend/dist 不存在${NC}"
    exit 1
fi

# 步骤 6: 测试启动命令
echo ""
echo "==> Step 5: 测试启动命令..."
echo "启动命令: npm start"
echo ""
echo -e "${YELLOW}提示: 按 Ctrl+C 停止服务器${NC}"
echo ""

# 设置生产环境变量
export NODE_ENV=production

# 启动服务器
npm start
