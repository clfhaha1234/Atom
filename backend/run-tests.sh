#!/bin/bash

echo "🧪 运行 Atoms 测试套件"
echo "============================================================"

# 设置环境变量
export ANTHROPIC_API_KEY=mock

# 运行各个测试
echo ""
echo "1️⃣ 单独 Agent 测试"
echo "------------------------------------------------------------"
npx ts-node src/agents/__tests__/individual-agents.test.ts

echo ""
echo "2️⃣ Agent 通信测试"
echo "------------------------------------------------------------"
npx ts-node src/agents/__tests__/agent-communication.test.ts 2>&1 | tail -50

echo ""
echo "3️⃣ 认证路由测试"
echo "------------------------------------------------------------"
npx ts-node src/routes/__tests__/auth.test.ts

echo ""
echo "4️⃣ 聊天路由测试"
echo "------------------------------------------------------------"
npx ts-node src/routes/__tests__/chat.test.ts 2>&1 | tail -50

echo ""
echo "5️⃣ 系统集成测试"
echo "------------------------------------------------------------"
npx ts-node src/__tests__/integration.test.ts 2>&1 | tail -50

echo ""
echo "============================================================"
echo "✅ 所有测试完成！"
echo "============================================================"
