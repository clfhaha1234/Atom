# 🚀 Atoms - Turn Ideas into Web Apps

Atoms 是一个类似 Lovable.dev 的产品，帮助用户通过对话将想法转化为可运行的 Web 应用。

## 功能特性

- ✅ 用户注册/登录 (Supabase Auth)
- ✅ 对话界面 (左侧对话，右侧代码预览)
- ✅ AI 智能体协作 (Mike, Emma, Bob, Alex)
- ✅ 代码预览和运行
- ✅ 实时消息更新

## 技术栈

### 前端
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand (状态管理)
- React Router
- Monaco Editor
- React Markdown

### 后端
- Node.js + Express
- TypeScript
- Anthropic Claude API
- Supabase (认证 + 数据库)

## 快速开始

### 1. 环境变量配置

#### 前端 (.env)
```bash
cd frontend
cp .env.example .env
```

编辑 `.env` 文件：
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3001
```

#### 后端 (.env)
```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件：
```
PORT=3001
ANTHROPIC_API_KEY=your_anthropic_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. 安装依赖

```bash
# 前端
cd frontend
npm install

# 后端
cd backend
npm install
```

### 3. 启动开发服务器

```bash
# 终端 1: 启动后端
cd backend
npm run dev

# 终端 2: 启动前端
cd frontend
npm run dev
```

### 4. 访问应用

- 前端: http://localhost:5173
- 后端 API: http://localhost:3001

## 项目结构

```
Atom/
├── frontend/          # React 前端应用
│   ├── src/
│   │   ├── components/    # UI 组件
│   │   ├── pages/         # 页面组件
│   │   ├── store/         # Zustand 状态管理
│   │   ├── lib/           # 工具函数
│   │   └── types/         # TypeScript 类型
│   └── package.json
├── backend/           # Node.js 后端
│   ├── src/
│   │   ├── routes/        # API 路由
│   │   ├── agents/        # AI 智能体
│   │   └── lib/           # 工具函数
│   └── package.json
├── plan.md            # 开发计划
└── README.md          # 本文档
```

## 使用说明

1. **注册/登录**: 访问首页，点击"开始使用"注册新账户
2. **开始对话**: 登录后进入聊天界面，描述你想做的项目
3. **查看代码**: AI 生成代码后，右侧会显示代码预览
4. **运行预览**: 代码预览区域可以直接运行和查看效果

## 开发计划

详细开发计划请查看 [plan.md](./plan.md)

## 许可证

MIT
