# OpenManus 沙盒实现分析

## 核心发现

OpenManus 使用了**两种沙盒方案**来支持复杂应用：

### 方案 1: Docker 沙盒（本地）
- **位置**: `app/sandbox/core/sandbox.py`
- **实现**: 使用 Docker 容器创建隔离环境
- **特点**: 
  - 本地运行
  - 完全控制
  - 需要 Docker 环境

### 方案 2: Daytona 沙盒（云服务）⭐ **推荐**
- **位置**: `app/daytona/sandbox.py`
- **实现**: 使用 Daytona 云平台创建沙盒
- **特点**:
  - 云端运行
  - 自动管理
  - 提供 VNC 和 Web 预览
  - 支持前后端完整环境

## Daytona 沙盒架构

### 1. 沙盒创建流程

```python
# 创建沙盒
sandbox = create_sandbox(
    password="VNC密码",
    project_id="项目ID"  # 可选
)

# 沙盒配置
- 镜像: browser-use 镜像（包含 Chrome、VNC、HTTP 服务器）
- 资源: CPU 2核, 内存 4GB, 磁盘 5GB
- 自动停止: 15分钟无活动
- 自动归档: 24小时
```

### 2. 沙盒工具集

OpenManus 提供了4个核心沙盒工具：

#### a) SandboxFilesTool - 文件操作
```python
功能：
- create_file: 创建文件
- str_replace: 替换字符串
- full_file_rewrite: 重写文件
- delete_file: 删除文件

特点：
- 自动检测 index.html，提供 HTTP 服务器 URL
- 所有操作在 /workspace 目录下
```

#### b) SandboxShellTool - Shell 命令执行
```python
功能：
- execute_command: 执行命令（支持非阻塞）
- check_command_output: 检查命令输出
- terminate_command: 终止命令
- list_commands: 列出所有会话

特点：
- 使用 tmux 会话管理
- 支持长时间运行的进程（如服务器）
- 非阻塞执行，适合启动服务
```

#### c) SandboxBrowserTool - 浏览器操作
```python
功能：
- 在沙盒中控制浏览器
- 访问生成的网站
- 截图和视觉反馈
```

#### d) SandboxVisionTool - 视觉工具
```python
功能：
- 截图
- 视觉分析
- UI 验证
```

### 3. 预览链接

```python
# VNC 预览（远程桌面）
vnc_link = sandbox.get_preview_link(6080)
# 用于远程访问沙盒桌面环境

# Web 预览（HTTP 服务器）
website_link = sandbox.get_preview_link(8080)
# 用于访问运行在 8080 端口的 Web 应用
```

## 关键配置

### Daytona 配置（config.toml）
```toml
[daytona]
daytona_api_key = "YOUR_API_KEY"              # 必需
daytona_server_url = "https://app.daytona.io/api"  # 可选
daytona_target = "us"                          # 区域: us/eu
sandbox_image_name = "whitezxj/sandbox:0.1.0"  # 沙盒镜像
VNC_password = "123456"                       # VNC 密码
```

### 沙盒镜像特点
- 预装 Chrome 浏览器
- VNC 服务器（端口 6080）
- HTTP 服务器（端口 8080）
- Supervisord 进程管理
- 完整的开发环境

## 工作流程

### 完整应用开发流程

```
1. 用户描述需求
   ↓
2. AI 生成代码（PRD → 架构 → 代码）
   ↓
3. 创建 Daytona 沙盒
   ↓
4. 使用 SandboxFilesTool 写入代码文件
   ↓
5. 使用 SandboxShellTool 执行命令：
   - npm install（安装依赖）
   - npm start（启动前端）
   - node server.js（启动后端）
   ↓
6. 获取预览链接：
   - VNC URL: 远程桌面访问
   - Website URL: Web 应用访问
   ↓
7. 使用 SandboxBrowserTool 测试应用
   ↓
8. 返回运行 URL 给用户
```

## 与当前 Atoms 项目的对比

### 当前 Atoms 实现
- ✅ 浏览器预览（简单前端）
- ❌ 无后端支持
- ❌ 无数据库支持
- ❌ 无 npm 依赖管理

### OpenManus 实现
- ✅ 完整沙盒环境
- ✅ 前后端支持
- ✅ 数据库支持（可在沙盒中安装）
- ✅ npm 依赖管理
- ✅ 实时预览（VNC + Web）

## 集成建议

### 方案 A: 集成 Daytona（推荐）

**优点**:
- 云端运行，无需本地 Docker
- 自动管理资源
- 提供预览链接
- 支持复杂应用

**需要**:
- Daytona API Key
- 配置 Daytona 服务

**实现步骤**:
1. 安装 `daytona` Python 包
2. 配置 API Key
3. 集成沙盒工具
4. 修改代码生成流程

### 方案 B: 集成 Docker 沙盒

**优点**:
- 完全本地控制
- 无外部依赖
- 适合私有部署

**需要**:
- Docker 环境
- Docker Python SDK

**实现步骤**:
1. 使用 `docker` Python 包
2. 实现容器管理
3. 集成文件操作
4. 集成命令执行

## 需要的 API Key 和工具

### 必需
1. **Daytona API Key** ⭐
   - 获取方式: https://app.daytona.io
   - 用途: 创建和管理沙盒

### 可选
2. **Docker**（如果使用本地方案）
   - 需要: Docker Desktop 或 Docker Engine
   - 用途: 本地容器管理

## 代码示例

### 创建沙盒
```python
from app.daytona.sandbox import create_sandbox

# 创建沙盒
sandbox = create_sandbox(
    password="your_vnc_password",
    project_id="user_project_123"
)

# 获取预览链接
vnc_url = sandbox.get_preview_link(6080).url
website_url = sandbox.get_preview_link(8080).url

print(f"VNC: {vnc_url}")
print(f"Website: {website_url}")
```

### 写入文件
```python
from app.tool.sandbox.sb_files_tool import SandboxFilesTool

tool = SandboxFilesTool(sandbox=sandbox)
result = await tool.execute(
    action="create_file",
    file_path="index.html",
    file_contents="<html>...</html>"
)
```

### 执行命令
```python
from app.tool.sandbox.sb_shell_tool import SandboxShellTool

tool = SandboxShellTool(sandbox=sandbox)
result = await tool.execute(
    action="execute_command",
    command="npm install",
    blocking=True,
    timeout=300
)
```

## 下一步行动

1. **获取 Daytona API Key**
   - 访问 https://app.daytona.io
   - 注册账号
   - 获取 API Key

2. **安装依赖**
   ```bash
   pip install daytona
   ```

3. **集成到 Atoms**
   - 修改 `backend/src/services/sandbox.ts`
   - 添加 Daytona 客户端
   - 集成沙盒工具

4. **更新工作流**
   - 代码生成后创建沙盒
   - 写入文件
   - 安装依赖
   - 启动服务
   - 返回预览 URL
