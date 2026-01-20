# Atoms 集成沙盒环境计划

## 当前状态

✅ **已完成**:
- 浏览器预览（简单前端应用）
- 流式响应
- 完整工作流（Emma → Bob → Alex）

❌ **缺失**:
- 沙盒环境
- 后端支持
- npm 依赖管理
- 数据库支持

## 集成方案

### 推荐方案: Daytona 沙盒（云服务）

**为什么选择 Daytona**:
1. ✅ 云端运行，无需本地 Docker
2. ✅ 自动资源管理
3. ✅ 提供 VNC 和 Web 预览
4. ✅ 支持复杂应用（前后端 + 数据库）
5. ✅ 已有成熟实现（OpenManus）

## 需要的资源

### 1. Daytona API Key ⭐ **必需**

**获取方式**:
1. 访问 https://app.daytona.io
2. 注册账号
3. 在 Dashboard 获取 API Key

**配置位置**:
```bash
# backend/.env
DAYTONA_API_KEY=your_api_key_here
DAYTONA_SERVER_URL=https://app.daytona.io/api  # 可选
DAYTONA_TARGET=us  # 或 eu
DAYTONA_VNC_PASSWORD=your_password  # VNC 访问密码
```

### 2. Python 依赖

**需要安装**:
```bash
cd backend
npm install  # 如果使用 Node.js 调用 Python
# 或
pip install daytona  # 如果直接使用 Python
```

### 3. 沙盒镜像

**默认镜像**: `whitezxj/sandbox:0.1.0`
- 预装 Chrome、VNC、HTTP 服务器
- 完整的开发环境

## 实现步骤

### Phase 1: 基础集成

1. **安装依赖**
   ```bash
   # 如果使用 Python 服务
   pip install daytona
   
   # 如果使用 Node.js，需要 Python 子进程或 HTTP API
   ```

2. **创建沙盒服务**
   ```typescript
   // backend/src/services/daytona-sandbox.ts
   - createSandbox(userId, projectId)
   - writeFiles(sandboxId, files)
   - runCommand(sandboxId, command)
   - getPreviewLinks(sandboxId)
   - deleteSandbox(sandboxId)
   ```

3. **集成到工作流**
   ```typescript
   // 在 alexCodeGenNode 后
   - 生成代码
   - 创建沙盒
   - 写入文件
   - 安装依赖（如果有 package.json）
   - 启动服务
   - 返回预览 URL
   ```

### Phase 2: 工具集成

1. **文件操作工具**
   - 创建/读取/更新/删除文件
   - 自动检测 index.html 并提供预览链接

2. **Shell 工具**
   - 执行命令（npm install, npm start 等）
   - 支持非阻塞执行（适合启动服务器）

3. **浏览器工具**（可选）
   - 在沙盒中测试应用
   - 截图和视觉验证

### Phase 3: 前端集成

1. **更新 CodePreview 组件**
   ```typescript
   // 如果有沙盒 URL，加载沙盒 URL
   // 如果没有，使用当前浏览器预览
   if (artifact.sandboxUrl) {
     // 加载沙盒 Web 预览
   } else {
     // 使用当前 Blob URL 预览
   }
   ```

2. **显示预览链接**
   - VNC URL（远程桌面）
   - Website URL（Web 应用）

## 代码结构

### 后端结构
```
backend/
├── src/
│   ├── services/
│   │   ├── sandbox.ts          # 当前（浏览器预览）
│   │   └── daytona-sandbox.ts  # 新增（Daytona 沙盒）
│   ├── agents/
│   │   └── mike.ts             # 修改：集成沙盒创建
│   └── routes/
│       └── chat-stream.ts       # 修改：返回沙盒 URL
```

### 前端结构
```
frontend/
├── src/
│   ├── components/
│   │   └── CodePreview.tsx     # 修改：支持沙盒 URL
│   └── types/
│       └── index.ts            # 新增：SandboxUrl 类型
```

## 配置示例

### backend/.env
```env
# Daytona 配置
DAYTONA_API_KEY=your_api_key_here
DAYTONA_SERVER_URL=https://app.daytona.io/api
DAYTONA_TARGET=us
DAYTONA_VNC_PASSWORD=your_password
DAYTONA_SANDBOX_IMAGE=whitezxj/sandbox:0.1.0
```

### backend/src/config.ts
```typescript
export const daytonaConfig = {
  apiKey: process.env.DAYTONA_API_KEY!,
  serverUrl: process.env.DAYTONA_SERVER_URL || 'https://app.daytona.io/api',
  target: process.env.DAYTONA_TARGET || 'us',
  vncPassword: process.env.DAYTONA_VNC_PASSWORD || '123456',
  sandboxImage: process.env.DAYTONA_SANDBOX_IMAGE || 'whitezxj/sandbox:0.1.0',
}
```

## API 调用示例

### 创建沙盒
```typescript
const sandbox = await daytona.createSandbox({
  image: 'whitezxj/sandbox:0.1.0',
  public: true,
  envVars: {
    VNC_PASSWORD: 'your_password',
    // ... 其他环境变量
  },
  resources: {
    cpu: 2,
    memory: 4,
    disk: 5,
  },
})
```

### 写入文件
```typescript
await sandbox.fs.upload_file(
  content.encode(),
  '/workspace/index.html'
)
```

### 执行命令
```typescript
const result = await sandbox.process.execute({
  command: 'npm install',
  cwd: '/workspace',
})
```

### 获取预览链接
```typescript
const vncUrl = sandbox.get_preview_link(6080).url
const websiteUrl = sandbox.get_preview_link(8080).url
```

## 工作流更新

### 当前流程
```
用户需求 → Emma(PRD) → Bob(架构) → Alex(代码) → 浏览器预览
```

### 新流程
```
用户需求 → Emma(PRD) → Bob(架构) → Alex(代码) 
  → 创建沙盒 → 写入文件 → 安装依赖 → 启动服务 
  → 返回预览 URL → 前端加载
```

## 测试计划

1. **单元测试**
   - 沙盒创建/删除
   - 文件操作
   - 命令执行

2. **集成测试**
   - 完整工作流
   - 前后端应用
   - 数据库连接

3. **端到端测试**
   - 用户描述需求
   - 生成完整应用
   - 在沙盒中运行
   - 验证功能

## 时间估算

- **Phase 1**: 2-3 天（基础集成）
- **Phase 2**: 2-3 天（工具集成）
- **Phase 3**: 1-2 天（前端集成）
- **总计**: 5-8 天

## 风险与挑战

1. **API Key 限制**
   - Daytona 可能有使用限制
   - 需要监控使用量

2. **成本**
   - 云服务可能有费用
   - 需要评估成本

3. **延迟**
   - 沙盒创建需要时间（~30秒）
   - 需要优化用户体验

4. **错误处理**
   - 沙盒创建失败
   - 命令执行失败
   - 需要完善的错误处理

## 下一步

1. **获取 Daytona API Key** ⭐
2. **安装依赖**
3. **实现基础沙盒服务**
4. **集成到工作流**
5. **测试验证**
