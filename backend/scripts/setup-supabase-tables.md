# 在 Supabase Dashboard 中创建数据库表

## 快速步骤

1. **打开 Supabase Dashboard**
   - 访问: https://supabase.com/dashboard
   - 登录你的账号

2. **选择项目**
   - 找到并选择你的项目

3. **进入 SQL Editor**
   - 点击左侧菜单的 **SQL Editor**
   - 点击 **New query**

4. **执行 SQL**
   - 复制下面的 SQL 代码
   - 粘贴到 SQL Editor 中
   - 点击 **Run** 执行

## SQL 代码

```sql
-- 项目表
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 项目状态表
CREATE TABLE IF NOT EXISTS project_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- 对话消息表
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  agent TEXT,
  artifacts JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_states_project_id ON project_states(project_id);
CREATE INDEX IF NOT EXISTS idx_project_states_user_id ON project_states(user_id);
CREATE INDEX IF NOT EXISTS idx_project_states_updated_at ON project_states(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_project_timestamp ON messages(project_id, timestamp DESC);

-- 自动更新 updated_at 的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 触发器
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_states_updated_at ON project_states;
CREATE TRIGGER update_project_states_updated_at
  BEFORE UPDATE ON project_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## 验证表是否创建成功

执行完 SQL 后，运行验证脚本：

```bash
cd backend
npx ts-node scripts/verify-and-setup.ts
```

如果看到 "✅ 所有表都已存在！"，说明创建成功。

## 注意事项

- 如果表已存在，SQL 会跳过创建（使用 `IF NOT EXISTS`）
- 触发器会自动更新 `updated_at` 字段
- 索引会提高查询性能
