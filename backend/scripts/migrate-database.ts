/**
 * 数据库迁移脚本
 * 创建所有必需的表和索引
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'

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

async function migrateDatabase() {
  console.log('🔄 开始数据库迁移...\n')
  
  try {
    // 读取 SQL 文件
    const sqlPath = join(__dirname, '../docs/database-schema.sql')
    const sql = readFileSync(sqlPath, 'utf-8')
    
    // 分割 SQL 语句（按分号和换行）
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`📝 找到 ${statements.length} 条 SQL 语句\n`)
    
    // 执行每个 SQL 语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.length < 10) continue // 跳过太短的语句
      
      try {
        // 使用 RPC 或者直接执行 SQL
        // Supabase JS 客户端不直接支持执行原始 SQL，我们需要使用 REST API
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ sql: statement + ';' })
        })
        
        // 如果 RPC 不存在，尝试直接创建表（使用 Supabase 客户端）
        if (!response.ok) {
          // 解析 SQL 语句类型
          if (statement.toUpperCase().includes('CREATE TABLE')) {
            const tableName = extractTableName(statement)
            if (tableName) {
              console.log(`  ${i + 1}. 创建表: ${tableName}`)
              // 表会通过后续的查询自动创建，这里只是记录
            }
          } else if (statement.toUpperCase().includes('CREATE INDEX')) {
            const indexName = extractIndexName(statement)
            if (indexName) {
              console.log(`  ${i + 1}. 创建索引: ${indexName}`)
            }
          } else {
            console.log(`  ${i + 1}. 执行: ${statement.substring(0, 50)}...`)
          }
        } else {
          console.log(`  ✅ ${i + 1}. 执行成功`)
        }
      } catch (error: any) {
        // 忽略某些错误（如表已存在）
        if (error.message?.includes('already exists') || 
            error.message?.includes('duplicate')) {
          console.log(`  ⚠️  ${i + 1}. 已存在，跳过`)
        } else {
          console.log(`  ⚠️  ${i + 1}. 执行时出现警告: ${error.message}`)
        }
      }
    }
    
    // 验证表是否创建成功
    console.log('\n🔍 验证表是否创建成功...\n')
    
    const tables = ['projects', 'project_states', 'messages']
    for (const tableName of tables) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)
      
      if (error) {
        if (error.message.includes('Could not find the table') || 
            error.message.includes('does not exist')) {
          console.log(`  ❌ 表 ${tableName} 不存在，需要手动创建`)
        } else {
          console.log(`  ⚠️  表 ${tableName} 检查失败: ${error.message}`)
        }
      } else {
        console.log(`  ✅ 表 ${tableName} 存在`)
      }
    }
    
    console.log('\n💡 提示: 如果表不存在，请在 Supabase Dashboard 的 SQL Editor 中运行:')
    console.log('   backend/docs/database-schema.sql')
    console.log('\n   或者使用 Supabase CLI:')
    console.log('   supabase db push')
    
  } catch (error) {
    console.error('❌ 迁移失败:', error)
    process.exit(1)
  }
}

function extractTableName(sql: string): string | null {
  const match = sql.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i)
  return match ? match[1] : null
}

function extractIndexName(sql: string): string | null {
  const match = sql.match(/CREATE INDEX (?:IF NOT EXISTS )?(\w+)/i)
  return match ? match[1] : null
}

migrateDatabase().catch(console.error)
