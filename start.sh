#!/bin/bash

# Atoms 项目启动脚本

echo "🚀 启动 Atoms 项目..."

# 检查环境变量
if [ ! -f "frontend/.env" ]; then
  echo "⚠️  请先配置 frontend/.env 文件"
  exit 1
fi

if [ ! -f "backend/.env" ]; then
  echo "⚠️  请先配置 backend/.env 文件"
  exit 1
fi

# 启动后端
echo "📦 启动后端服务器..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# 等待后端启动
sleep 3

# 启动前端
echo "🎨 启动前端开发服务器..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "✅ 项目已启动！"
echo "📱 前端: http://localhost:5173"
echo "🔧 后端: http://localhost:3001"
echo ""
echo "按 Ctrl+C 停止服务器"

# 等待用户中断
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
