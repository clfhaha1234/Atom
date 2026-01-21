# 使用 Python 脚本创建数据库表

## 快速开始

### 方法 1: 使用数据库密码（推荐）

1. **获取数据库密码**
   - 打开 Supabase Dashboard: https://supabase.com/dashboard
   - 选择你的项目
   - 进入 **Settings -> Database**
   - 在 **Connection string** 中找到密码（在 `postgresql://postgres:[password]@...` 中）

2. **设置环境变量**
   
   在 `.env` 文件中添加：
   ```bash
   SUPABASE_DB_PASSWORD=your_password_here
   ```

3. **运行脚本**
   ```bash
   cd backend
   python3 scripts/create-tables.py
   ```

### 方法 2: 使用完整连接字符串

1. **获取连接字符串**
   - 在 Supabase Dashboard -> Settings -> Database
   - 复制 **Connection string**（URI 格式）

2. **设置环境变量**
   
   在 `.env` 文件中添加：
   ```bash
   SUPABASE_DB_CONNECTION_STRING=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
   ```

3. **运行脚本**
   ```bash
   cd backend
   python3 scripts/create-tables.py
   ```

## 验证

运行脚本后，如果看到：
```
✅ 所有表创建成功！
🎉 数据库已就绪，可以开始使用了
```

说明表创建成功。

## 故障排除

如果遇到连接问题：
1. 检查密码是否正确
2. 检查网络连接
3. 确认 Supabase 项目已启用数据库访问
4. 如果仍然失败，可以使用 Supabase Dashboard 的 SQL Editor 手动执行 SQL
