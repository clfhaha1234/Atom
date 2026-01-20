# 当前代码运行实现说明

## 实现方式

### 当前方案：浏览器内预览（无沙盒）

**工作原理**：
1. AI 生成代码（React 组件、CSS、package.json）
2. 前端将代码转换为 HTML 文件
3. 使用 `Blob URL` 创建临时 HTML
4. 在 `iframe` 中加载并运行
5. 通过 CDN 加载 React 和 Babel
6. 在浏览器中编译和运行 JSX

**代码位置**：
- `frontend/src/components/CodePreview.tsx` - 预览组件
- `backend/src/agents/mike.ts` - 代码生成逻辑

## 详细流程

```
用户描述需求
  ↓
AI 生成代码（JSON 格式）
{
  "App.tsx": "React 组件代码",
  "index.css": "样式代码",
  "package.json": "依赖配置"
}
  ↓
前端接收代码
  ↓
CodePreview 组件处理：
  1. 选择主文件（通常是 App.tsx）
  2. 生成 HTML 模板
  3. 注入 React CDN 链接
  4. 注入 Babel Standalone（用于编译 JSX）
  5. 创建 Blob URL
  ↓
iframe 加载 Blob URL
  ↓
浏览器执行：
  - 加载 React 库（CDN）
  - 使用 Babel 编译 JSX
  - 渲染 React 组件
  ↓
用户看到运行效果
```

## 技术细节

### HTML 模板生成

```typescript
// 生成包含 React 的 HTML
const html = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${jsxCode}
    ReactDOM.render(<App />, document.getElementById('root'));
  </script>
</body>
</html>
`
```

### Blob URL 创建

```typescript
const blob = new Blob([html], { type: 'text/html' })
const url = URL.createObjectURL(blob)
// url 类似: blob:http://localhost:5173/abc-123-def
```

## 当前实现的限制

### ❌ 无法支持

1. **后端 API**
   - 无法运行 Express/Fastify 等后端框架
   - 无法处理 HTTP 请求
   - 无法实现 RESTful API

2. **数据库**
   - 无法连接 PostgreSQL/MySQL
   - 无法使用 ORM（Prisma/Sequelize）
   - 无法持久化数据

3. **npm 包管理**
   - 无法使用 `npm install`
   - 只能通过 CDN 加载库
   - 无法使用复杂的依赖

4. **构建工具**
   - 无法使用 Vite/Webpack
   - 无法使用 TypeScript 编译
   - 无法代码分割和优化

5. **文件系统**
   - 无法读写文件
   - 无法访问本地文件系统

6. **环境变量**
   - 无法设置 `process.env`
   - 无法配置环境

### ✅ 可以支持

1. **简单 React 组件**
   - 基础组件
   - 状态管理（useState）
   - 事件处理

2. **CSS 样式**
   - 内联样式
   - CSS 文件
   - 基础动画

3. **前端交互**
   - 表单处理
   - 用户输入
   - DOM 操作

4. **静态内容**
   - 文本展示
   - 图片展示
   - 布局

## 是否需要沙盒环境？

### 场景分析

#### 场景 1: 简单前端应用 ✅ 当前方案足够
```
用户需求："做一个待办事项列表"
生成代码：
  - App.tsx（React 组件）
  - index.css（样式）
  - package.json（基础配置）

运行方式：浏览器预览 ✅
```

#### 场景 2: 全栈应用 ❌ 需要沙盒
```
用户需求："做一个带后端的博客系统"
生成代码：
  - App.tsx（前端）
  - server.js（Express 后端）
  - database.js（数据库连接）
  - package.json（包含 express, prisma）

运行方式：需要 Docker 容器 ✅
```

## 未来扩展方案

### 方案 1: Docker 容器沙盒（推荐）

**实现步骤**：
1. 检测代码是否需要后端
2. 如果需要，创建 Docker 容器
3. 在容器中安装依赖和运行
4. 返回容器 URL

**优点**：
- 完整的环境支持
- 完全隔离
- 支持前后端

**缺点**：
- 需要 Docker 环境
- 资源消耗较大
- 启动时间较长

### 方案 2: 云沙盒服务

**使用 CodeSandbox/StackBlitz**：
- 调用 API 创建沙盒
- 上传代码
- 返回运行 URL

**优点**：
- 无需维护基础设施
- 快速启动
- 稳定可靠

**缺点**：
- 需要 API Key
- 可能有成本
- 依赖第三方服务

## 当前状态总结

✅ **已实现**：
- 浏览器内代码预览
- React 组件运行
- 实时预览效果

❌ **未实现**：
- 沙盒环境
- 后端支持
- 数据库连接
- npm 依赖管理

📝 **建议**：
- MVP 阶段：保持当前方案（适合简单应用）
- 下一阶段：实现 Docker 沙盒（支持全栈应用）
