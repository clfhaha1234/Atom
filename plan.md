# 🚀 Atoms MVP 开发计划

## 项目概述
Atoms 是一个类似 Lovable.dev 的产品，帮助用户通过对话将想法转化为可运行的 Web 应用。

## 核心功能
1. ✅ 用户注册/登录
2. ✅ 对话界面（左侧对话，右侧代码实现）
3. ✅ AI 智能体协作（Mike, Emma, Bob, Alex）
4. ✅ 代码预览和运行

## 技术栈

### 前端
- React 18 + TypeScript
- Vite (构建工具)
- Tailwind CSS (样式)
- Zustand (状态管理)
- React Router (路由)
- Monaco Editor (代码编辑器)
- React Markdown (Markdown 渲染)

### 后端
- Node.js + Express
- TypeScript
- LangGraph (AI 工作流)
- Anthropic Claude API
- Supabase (认证 + 数据库)
- WebSocket (实时通信)

## 开发阶段

### Phase 1: 项目初始化 ✅
- [x] 创建项目规划文档
- [x] 初始化前端项目
- [x] 初始化后端项目
- [x] 配置开发环境

### Phase 2: 基础架构 ✅
- [x] 前端路由配置
- [x] 后端 API 结构
- [x] Supabase 集成
- [x] 环境变量配置示例

### Phase 3: 认证系统 ✅
- [x] Landing Page
- [x] 登录页面
- [x] 注册页面
- [x] Supabase Auth 集成
- [x] 路由保护

### Phase 4: 聊天界面 ✅
- [x] ChatPage 布局
- [x] 消息组件 (ChatMessage)
- [x] 输入组件 (ChatInput)
- [x] 消息状态管理
- [x] 实时消息更新

### Phase 5: AI 智能体 ✅
- [x] Mike Agent (Supervisor)
- [x] 完整工作流实现 (Emma → Bob → Alex)
- [x] 流式响应实现 (SSE)
- [x] API 集成
- [x] Prompt 优化（精简输出）
  - Emma (产品经理): 输出精简为 bullet points
  - Bob (架构师): 输出精简为技术要点
  - Alex (工程师): 修复时只输出 diff 部分

### Phase 6: 代码预览 ✅
- [x] 代码编辑器集成 (Monaco Editor)
- [x] 代码预览功能 (iframe + Blob URL)
- [x] 运行环境配置
- [x] TypeScript 到 JavaScript 转换
  - 自动移除 import 语句
  - 自动移除 TypeScript 接口和类型注解
  - 自动移除 React.FC 类型注解
  - 自动移除泛型类型参数
- [x] 浏览器预览模式（简单前端应用）
- [x] 沙盒环境支持（Daytona，复杂应用）

### Phase 7: 验证和测试 ✅
- [x] 自动验证预览页面
- [x] 截图功能
- [x] AI 分析截图（可选）
- [x] 自动修复流程
- [x] 测试脚本完善
  - test-sandbox-screenshot.ts (沙盒预览测试)
  - test-calculator.ts (完整流程测试)

## 项目结构

```
Atom/
├── frontend/          # React 前端应用
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/
│   │   ├── lib/
│   │   └── types/
│   ├── package.json
│   └── vite.config.ts
├── backend/           # Node.js 后端
│   ├── src/
│   │   ├── routes/
│   │   ├── agents/
│   │   ├── lib/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── plan.md           # 本文档
└── .env              # 环境变量（已存在）
```

## 当前进度
- ✅ 创建开发计划
- ✅ 初始化项目结构
- ✅ 前端项目搭建完成 (React + Vite + Tailwind)
- ✅ 后端项目搭建完成 (Node.js + Express)
- ✅ 实现 Landing Page
- ✅ 实现登录/注册页面
- ✅ 实现聊天界面核心功能
- ✅ 实现 Mike Agent (简化版)
- ✅ 实现代码预览功能
- 🔄 需要配置环境变量和测试

## 已完成功能
1. ✅ 前端路由配置 (Landing, Login, Signup, Chat)
2. ✅ Supabase 认证集成
3. ✅ 聊天界面 UI (左侧对话，右侧代码预览)
4. ✅ 消息组件和输入组件
5. ✅ AI 智能体完整实现 (Mike, Emma, Bob, Alex)
   - 流式响应支持
   - 完整工作流执行
   - Prompt 优化（精简输出）
6. ✅ 代码预览组件 (Monaco Editor + iframe)
   - 代码编辑器（Monaco Editor）
   - Web 预览（iframe + Blob URL）
   - TypeScript 自动转换
7. ✅ 沙盒环境支持
   - Daytona 沙盒集成
   - 浏览器预览模式（降级）
   - 自动部署到沙盒
8. ✅ 验证和测试功能
   - 自动验证预览页面
   - 截图功能
   - 自动修复流程
   - 测试脚本完善

## 最新改进（2025-01）

### 代码生成优化 ✅
- 完善的 TypeScript 清理逻辑
  - 移除所有 import 语句（包括 CSS import）
  - 移除 TypeScript 接口定义
  - 移除 React.FC 和类型注解
  - 移除泛型类型参数
- 修复了验证失败时错误信息被当作代码的问题
- 改进了修复流程，区分原始需求和错误信息

### Prompt 优化 ✅
- Emma (产品经理): 输出精简为 bullet points，每个要点一行
- Bob (架构师): 输出精简为技术要点，避免冗长描述
- Alex (工程师): 修复时优先显示 diff 部分，完整代码放在最后

### 测试脚本完善 ✅
- test-sandbox-screenshot.ts: 沙盒预览功能测试
- test-calculator.ts: 完整工作流测试
- 智能等待逻辑（替代固定延迟）
- 详细的页面内容分析
- 调试截图功能

## 下一步行动
1. ⚠️ 配置环境变量 (.env) - 需要用户配置
   - ANTHROPIC_API_KEY (必需)
   - DAYTONA_API_KEY (可选，用于沙盒)
   - SUPABASE_URL, SUPABASE_ANON_KEY (必需)
2. 🔄 完善错误处理 - 改进错误边界和提示
3. 🔄 性能优化 - 代码分割、虚拟滚动
4. 🔄 功能增强 - 支持更多文件类型、代码编辑

## 快速启动

1. 配置环境变量：
   - 复制 `frontend/.env.example` 到 `frontend/.env` 并填入 Supabase 配置
   - 复制 `backend/.env.example` 到 `backend/.env` 并填入 API Keys

2. 安装依赖：
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```

3. 启动项目：
   ```bash
   # 方式1: 使用启动脚本
   ./start.sh
   
   # 方式2: 手动启动
   # 终端1
   cd backend && npm run dev
   # 终端2
   cd frontend && npm run dev
   ```

4. 访问应用：
   - 前端: http://localhost:5173
   - 后端: http://localhost:3001
