# 自动化测试脚本

## 测试计算器

运行自动化测试，模拟用户需求"生成一个计算器网页版"，并验证结果：

```bash
cd backend
npm run test:calculator
```

或者直接运行：

```bash
cd backend
npx ts-node scripts/test-calculator.ts
```

## 测试流程

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

- 截图保存在 `backend/screenshots/test-calculator-*.png`
- 预览 HTML 保存在 `backend/temp/test-calculator-*.html`（如果没有沙盒）

## 环境要求

- Node.js 18+ (支持内置 fetch)
- 或者安装 node-fetch: `npm install node-fetch@2 --save-dev`
- Puppeteer 已安装（用于截图和测试）

## 配置

可以通过环境变量配置：

```bash
API_URL=http://localhost:3001 npm run test:calculator
```
