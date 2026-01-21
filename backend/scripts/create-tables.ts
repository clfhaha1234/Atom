/**
 * 使用 Supabase REST API 创建数据库表
 * 由于 Supabase JS 客户端不支持直接执行 SQL，我们使用 REST API
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { resolve } from 'path'

// Load from root .env file
dotenv.config({ path: resolve(__dirname, '../../.env') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 需要设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTables() {
  console.log('🔄 开始创建数据库表...\n')
  
  // 读取 SQL 文件内容
  const sqlStatements = `
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
`.trim()

  try {
    // 使用 Supabase Management API 执行 SQL
    // 注意：这需要 Supabase 项目启用 SQL 执行功能
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: sqlStatements })
    })

    if (response.ok) {
      console.log('✅ SQL 执行成功')
    } else {
      const errorText = await response.text()
      console.log('⚠️  无法通过 API 执行 SQL，错误:', errorText)
      console.log('\n💡 请手动在 Supabase Dashboard 执行以下 SQL:\n')
      console.log(sqlStatements)
      console.log('\n   或者使用 Supabase CLI:')
      console.log('   supabase db push')
    }
    
    // 验证表是否存在
    console.log('\n🔍 验证表是否创建成功...\n')
    
    const tables = ['projects', 'project_states', 'messages']
    let allTablesExist = true
    
    for (const tableName of tables) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)
      
      if (error) {
        if (error.message.includes('Could not find the table') || 
            error.message.includes('does not exist')) {
          console.log(`  ❌ 表 ${tableName} 不存在`)
          allTablesExist = false
        } else {
          // 其他错误（如权限问题）可能表示表存在但无法访问
          console.log(`  ⚠️  表 ${tableName} 检查失败: ${error.message}`)
        }
      } else {
        console.log(`  ✅ 表 ${tableName} 存在`)
      }
    }
    
    if (!allTablesExist) {
      console.log('\n📋 请复制以下 SQL 到 Supabase Dashboard 的 SQL Editor 执行:\n')
      console.log('─'.repeat(60))
      console.log(sqlStatements)
      console.log('─'.repeat(60))
    } else {
      console.log('\n✅ 所有表已创建成功！')
    }
    
  } catch (error: any) {
    console.error('❌ 创建表时出错:', error.message)
    console.log('\n📋 请手动在 Supabase Dashboard 执行以下 SQL:\n')
    console.log(sqlStatements)
  }
}

createTables().catch(console.error)
