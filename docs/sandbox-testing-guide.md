# 沙盒测试指南

## 测试文件说明

### 1. TypeScript 测试 (`backend/src/services/__tests__/sandbox.test.ts`)
- 使用 Jest 测试框架
- 测试 TypeScript 沙盒服务
- 包含单元测试和集成测试

### 2. Python 测试 (`backend/scripts/test_daytona.py`)
- 直接测试 Python 脚本
- 测试 Daytona API 调用
- 完整的端到端测试

### 3. Shell 测试脚本 (`backend/scripts/run-sandbox-tests.sh`)
- 便捷的测试运行脚本
- 自动检查环境
- 自动安装依赖

## 运行测试

### 方法 1: 使用 Shell 脚本（推荐）

```bash
cd backend/scripts
./run-sandbox-tests.sh
```

### 方法 2: 直接运行 Python 测试

```bash
cd backend/scripts
python3 test_daytona.py
```

### 方法 3: 运行 TypeScript 测试

```bash
cd backend
npm test -- sandbox.test.ts
```

## 测试内容

### Python 测试包含：

1. **创建沙盒**
   - 验证 API Key
   - 创建沙盒环境
   - 获取预览链接

2. **写入文件**
   - 写入测试文件到沙盒
   - 验证文件路径

3. **执行命令**
   - 执行阻塞命令
   - 验证命令输出
   - 验证文件存在

4. **读取文件**
   - 通过命令读取文件
   - 验证文件内容

5. **删除沙盒**
   - 清理测试资源

### TypeScript 测试包含：

1. **needsSandbox 检测**
   - 简单前端代码 → false
   - 后端代码 → true
   - 包含后端依赖 → true

2. **createSandbox**
   - 简单代码 → 浏览器预览
   - 复杂代码 → Daytona 沙盒

3. **writeFile**
   - 写入文件到沙盒
   - 验证文件内容

4. **runCommand**
   - 阻塞命令执行
   - 非阻塞命令执行

5. **deleteSandbox**
   - 删除沙盒

6. **完整工作流**
   - 创建 → 写入 → 执行 → 删除

## 环境要求

### 必需
- Python 3.8+
- `daytona` Python 包
- `DAYTONA_API_KEY` 环境变量

### 安装依赖

```bash
pip install daytona==0.21.8 structlog==25.4.0
```

## 测试输出示例

```
============================================================
Daytona 沙盒功能测试
============================================================
✅ API Key 已配置
   Server URL: https://app.daytona.io/api
   Target: us

🧪 测试 1: 创建沙盒...
✅ 沙盒创建成功!
   Sandbox ID: sandbox-abc123
   VNC URL: https://6080-sandbox-abc123.h7890.daytona.work
   Website URL: https://8080-sandbox-abc123.h7890.daytona.work

🧪 测试 2: 写入文件...
✅ 文件写入成功: File test-file.txt written successfully

🧪 测试 3: 执行命令...
✅ 命令执行成功!
   输出: total 12
   drwxr-xr-x 2 root root 4096 ...
   -rw-r--r-- 1 root root   25 ... test-file.txt
✅ 验证: 文件已成功写入

🧪 测试 4: 读取文件...
✅ 文件读取成功，内容正确!
   内容: Hello from test!
   This is a test file.

🧪 测试 5: 删除沙盒...
✅ 沙盒删除成功: Sandbox sandbox-abc123 deleted

============================================================
测试结果: 5/5 通过
============================================================
🎉 所有测试通过!
```

## 故障排除

### 问题 1: API Key 未设置

**错误信息**:
```
❌ 错误: DAYTONA_API_KEY 环境变量未设置
```

**解决方案**:
```bash
export DAYTONA_API_KEY=your_api_key
# 或
# 确保 backend/.env 文件存在并包含 DAYTONA_API_KEY
```

### 问题 2: daytona 包未安装

**错误信息**:
```
ModuleNotFoundError: No module named 'daytona'
```

**解决方案**:
```bash
pip install daytona==0.21.8 structlog==25.4.0
```

### 问题 3: 沙盒创建失败

**可能原因**:
- API Key 无效
- 网络连接问题
- Daytona 服务不可用

**解决方案**:
1. 验证 API Key 是否正确
2. 检查网络连接
3. 查看 Daytona Dashboard: https://app.daytona.io

### 问题 4: 命令执行超时

**可能原因**:
- 沙盒启动需要时间
- 命令执行时间过长

**解决方案**:
- 增加超时时间
- 等待沙盒完全启动后再执行命令

## 跳过测试

如果不想运行需要 API Key 的测试，可以使用 `it.skip()`:

```typescript
it.skip('should create Daytona sandbox', async () => {
  // 测试代码
})
```

## 持续集成

可以在 CI/CD 中运行测试：

```yaml
# .github/workflows/test.yml
- name: Run Sandbox Tests
  env:
    DAYTONA_API_KEY: ${{ secrets.DAYTONA_API_KEY }}
  run: |
    cd backend/scripts
    ./run-sandbox-tests.sh
```

## 注意事项

1. **资源清理**: 测试会自动清理创建的沙盒，但如果测试中断，可能需要手动清理
2. **API 限制**: Daytona 可能有使用限制，注意不要过度测试
3. **成本**: 创建沙盒会消耗资源，注意控制测试频率
4. **网络**: 需要稳定的网络连接访问 Daytona API

## 下一步

测试通过后，可以：
1. 集成到主工作流
2. 测试完整应用生成流程
3. 验证前后端应用部署
