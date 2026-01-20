# 错误处理和自动修复需求

## 需求概述

### 1. 布局调整
- Chat 页面占比：33%
- 代码可视化区域：67%

### 2. 错误检测和显示

#### 错误来源
1. **代码生成错误**
   - 语法错误
   - 类型错误
   - 运行时错误

2. **沙盒部署错误**
   - 文件写入失败
   - 依赖安装失败
   - 服务启动失败

3. **API 调用错误**
   - 网络错误
   - 超时错误
   - 认证错误

#### 错误显示位置
- 在 Chat 消息中显示错误
- 错误消息格式：
  ```
  ❌ 错误：{错误类型}
  {错误详情}
  
  [修复] 按钮
  ```

### 3. 自动修复流程

#### 用户交互
1. 错误出现在 Chat 中
2. 显示"修复"按钮
3. 用户点击"修复"
4. 显示"正在修复..."
5. 调用修复 API
6. 显示修复结果

#### 修复逻辑
1. **分析错误**
   - 识别错误类型
   - 提取错误信息
   - 定位问题文件

2. **生成修复方案**
   - 调用 AI 分析错误
   - 生成修复代码
   - 验证修复方案

3. **应用修复**
   - 更新代码文件
   - 重新部署（如果需要）
   - 验证修复结果

4. **反馈结果**
   - 成功：显示修复后的代码
   - 失败：显示失败原因，提供重试

## 实现方案

### 前端部分

1. **错误消息组件**
   - 显示错误信息
   - 修复按钮
   - 修复状态

2. **修复流程**
   - 发送修复请求
   - 显示修复进度
   - 更新代码显示

### 后端部分

1. **错误检测**
   - 代码验证
   - 沙盒状态检查
   - 错误分类

2. **修复服务**
   - 错误分析
   - 修复代码生成
   - 修复应用

3. **API 端点**
   - POST /api/chat/fix-error
   - 接收错误信息
   - 返回修复结果

## 工作流程

```
用户操作
  ↓
错误发生
  ↓
错误显示在 Chat
  ↓
用户点击"修复"
  ↓
发送修复请求
  ↓
AI 分析错误
  ↓
生成修复代码
  ↓
应用修复
  ↓
更新代码显示
  ↓
验证修复结果
```

## 技术实现

### 错误类型定义
```typescript
interface ErrorInfo {
  type: 'syntax' | 'runtime' | 'deployment' | 'network'
  message: string
  file?: string
  line?: number
  stack?: string
}
```

### 修复请求
```typescript
interface FixRequest {
  errorId: string
  errorInfo: ErrorInfo
  codeContext: Record<string, string>
}
```

### 修复响应
```typescript
interface FixResponse {
  success: boolean
  fixedCode?: Record<string, string>
  message: string
  newError?: ErrorInfo
}
```
