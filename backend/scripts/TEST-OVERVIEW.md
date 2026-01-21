# 测试文件概览

本文档总结了所有测试脚本的功能、用途和运行方式。

## 测试文件列表

### 1. `test-calculator.ts` - 端到端计算器生成测试
**功能**: 完整的端到端测试，从用户请求到生成可用的计算器应用

**测试流程**:
1. 发送消息 "生成一个计算器网页版" 到 API
2. 接收流式响应，显示各个 Agent 的工作进度
3. 收集生成的 PRD、架构、代码和沙盒 URL
4. 如果没有沙盒 URL，从代码生成预览 HTML
5. 使用 Puppeteer 访问预览页面并验证功能
6. 检查预期功能（计算器元素、数字、按钮、运算）

**运行方式**:
```bash
npm run test:calculator
# 或
npx ts-node scripts/test-calculator.ts
```

**输出**:
- 截图: `screenshots/test-calculator-*.png`
- 预览 HTML: `temp/test-calculator-*.html` (如果没有沙盒)

**预期结果**: 生成完整的计算器应用，包含所有必需功能

---

### 2. `test-follow-up.ts` - Follow-up 场景测试
**功能**: 测试修改请求时是否正确保留原有代码

**测试流程**:
1. 第一次生成完整代码（计算器）
2. 保存状态到数据库
3. 发送修改请求（"优化刚才那个代码库，把按钮颜色改成蓝色"）
4. 验证新代码是否保留了原有代码，只修改了 diff 部分

**运行方式**:
```bash
npm run test:follow-up
# 或
npx ts-node scripts/test-follow-up.ts
```

**验证项**:
- ✅ 文件数量保持一致
- ✅ 代码保留率 > 80%
- ✅ 检测到颜色修改（蓝色相关）
- ✅ 核心功能保留（useState, calculate, buttons, display）
- ✅ 关键函数保留（inputNumber, inputOperation, performCalculation, clear, calculate）

**预期结果**: 代码正确保留，只修改了需要的部分，核心功能完整

---

### 3. `test-verify-and-fix.ts` - 验证和修复流程测试
**功能**: 测试 Mike 验证预览页面并触发 Alex 修复的功能

**测试流程**:
1. 生成一个初始代码（计算器，故意缺少运算符按钮）
2. 验证预览页面，发现问题
3. 如果发现问题，触发修复流程
4. 检查修复后的代码
5. 再次验证修复后的代码

**运行方式**:
```bash
npm run test:verify-fix
# 或
npx ts-node scripts/test-verify-and-fix.ts
```

**输出**:
- 修复后的代码保存在: `test-output/fixed-*.tsx`

**预期结果**: 发现问题后成功触发修复，修复后的代码通过验证

---

### 4. `test-sandbox-screenshot.ts` - 沙盒截图功能测试
**功能**: 测试沙盒生成网页 preview 然后截图功能

**测试流程**:
1. 创建沙盒（Daytona 或 Browser Preview）
2. 写入代码文件到沙盒
3. 如果是 React 项目，安装依赖并启动服务器
4. 使用 verifyPreview 截图预览页面
5. 使用 Puppeteer 深入检查页面内容
6. 验证页面是否正确渲染

**运行方式**:
```bash
npm run test:sandbox-screenshot
# 或
npx ts-node scripts/test-sandbox-screenshot.ts
```

**输出**:
- 截图保存在: `screenshots/` 目录
- 调试截图: `screenshots/debug-failure-*.png` (如果渲染失败)

**预期结果**: 沙盒成功创建，页面正确渲染，截图功能正常

---

## 测试依赖

所有测试都需要：
- ✅ Supabase 数据库表已创建（projects, project_states, messages）
- ✅ 环境变量配置正确（.env 文件）
- ✅ 后端服务运行（对于需要 API 的测试）

## 环境变量

测试脚本会读取以下环境变量：
- `SUPABASE_URL` - Supabase 项目 URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key
- `SUPABASE_DB_PASSWORD` - 数据库密码（用于直接连接）
- `API_URL` - 后端 API 地址（默认: http://localhost:3001）
- `ANTHROPIC_API_KEY` - Anthropic API Key（用于 Agent）

## 运行所有测试

可以创建一个统一的测试运行脚本：

```bash
# 运行所有测试
npm run test:all
```

## 测试覆盖范围

| 测试文件 | 覆盖功能 | 状态 |
|---------|---------|------|
| test-calculator.ts | 端到端生成流程 | ✅ |
| test-follow-up.ts | Follow-up 场景 | ✅ |
| test-verify-and-fix.ts | 验证和修复流程 | ✅ |
| test-sandbox-screenshot.ts | 沙盒和截图功能 | ✅ |

## 注意事项

1. **test-calculator.ts** 需要后端服务运行，因为它会调用 API
2. **test-follow-up.ts** 需要数据库表已创建
3. **test-verify-and-fix.ts** 需要 verify 服务可用
4. **test-sandbox-screenshot.ts** 需要沙盒服务配置正确

## 故障排除

如果测试失败：
1. 检查环境变量是否正确配置
2. 确认数据库表已创建
3. 检查后端服务是否运行（对于 API 测试）
4. 查看错误日志和截图（如果有）
5. 检查网络连接（对于沙盒测试）
