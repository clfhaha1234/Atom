# 自动化测试脚本

## 快速开始

运行所有测试：
```bash
cd backend
npm run test:all
```

运行单个测试：
```bash
npm run test:follow-up          # Follow-up 场景测试
npm run test:verify-fix         # 验证和修复流程测试
npm run test:sandbox-screenshot # 沙盒截图功能测试
npm run test:calculator         # 端到端计算器生成测试（需要 API）
```

## 测试文件概览

详细说明请查看 [TEST-OVERVIEW.md](./TEST-OVERVIEW.md)

### 1. test-follow-up.ts - Follow-up 场景测试
测试修改请求时是否正确保留原有代码。

**运行**: `npm run test:follow-up`

### 2. test-verify-and-fix.ts - 验证和修复流程测试
测试 Mike 验证预览页面并触发 Alex 修复的功能。

**运行**: `npm run test:verify-fix`

### 3. test-sandbox-screenshot.ts - 沙盒截图功能测试
测试沙盒生成网页 preview 然后截图功能。

**运行**: `npm run test:sandbox-screenshot`

### 4. test-calculator.ts - 端到端计算器生成测试
完整的端到端测试，从用户请求到生成可用的计算器应用。

**运行**: `npm run test:calculator` (需要后端 API 运行)

## 测试流程示例（test-calculator.ts）

1. **发送消息** - 模拟用户发送"生成一个计算器网页版"
2. **接收流式响应** - 实时显示各个 Agent 的工作进度
3. **收集结果** - 收集 PRD、架构、代码和沙盒 URL
4. **生成预览** - 如果没有沙盒 URL，从代码生成预览 HTML
5. **测试预览** - 使用 Puppeteer 访问预览页面并验证功能
6. **输出结果** - 显示测试结果和发现的问题

## 预期功能检查

测试会自动检查以下功能：
- ✅ 计算器相关元素
- ✅ 数字显示
- ✅ 按钮交互
- ✅ 运算功能

## 输出文件

- 截图保存在 `backend/screenshots/test-*.png`
- 预览 HTML 保存在 `backend/temp/test-*.html`（如果没有沙盒）
- 修复后的代码保存在 `backend/test-output/fixed-*.tsx`（verify-fix 测试）

## 环境要求

- Node.js 18+ (支持内置 fetch)
- 或者安装 node-fetch: `npm install node-fetch@2 --save-dev`
- Puppeteer 已安装（用于截图和测试）
- Supabase 数据库表已创建（projects, project_states, messages）

## 环境变量配置

测试脚本会读取以下环境变量：

```bash
# Supabase 配置
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_DB_PASSWORD=your_db_password  # 可选，用于直接连接数据库

# API 配置（test-calculator.ts 需要）
API_URL=http://localhost:3001

# Anthropic API（Agent 需要）
ANTHROPIC_API_KEY=your_api_key
```

## 配置示例

```bash
# 运行单个测试
API_URL=http://localhost:3001 npm run test:calculator

# 运行所有测试
npm run test:all
```

## 故障排除

如果测试失败：
1. 检查环境变量是否正确配置
2. 确认数据库表已创建（运行 `npx ts-node scripts/verify-and-setup.ts`）
3. 检查后端服务是否运行（对于 API 测试）
4. 查看错误日志和截图（如果有）
5. 检查网络连接（对于沙盒测试）
