/**
 * 验证数据库表是否存在，如果不存在则提供创建说明
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'

dotenv.config()

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

async function verifyTables() {
  console.log('🔍 检查数据库表...\n')
  
  const tables = ['projects', 'project_states', 'messages']
  const missingTables: string[] = []
  
  for (const tableName of tables) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1)
    
    if (error) {
      if (error.message.includes('Could not find the table') || 
          error.message.includes('does not exist')) {
        console.log(`  ❌ 表 ${tableName} 不存在`)
        missingTables.push(tableName)
      } else {
        console.log(`  ⚠️  表 ${tableName} 检查失败: ${error.message}`)
      }
    } else {
      console.log(`  ✅ 表 ${tableName} 存在`)
    }
  }
  
  if (missingTables.length > 0) {
    console.log(`\n❌ 发现 ${missingTables.length} 个缺失的表\n`)
    console.log('📋 请按照以下步骤创建表:\n')
    console.log('1. 打开 Supabase Dashboard: https://supabase.com/dashboard')
    console.log('2. 选择你的项目')
    console.log('3. 进入 SQL Editor')
    console.log('4. 复制并执行以下 SQL:\n')
    console.log('─'.repeat(60))
    
    // 读取 SQL 文件
    const sqlPath = join(__dirname, '../docs/database-schema.sql')
    const sql = readFileSync(sqlPath, 'utf-8')
    console.log(sql)
    console.log('─'.repeat(60))
    console.log('\n或者使用 Supabase CLI:')
    console.log('  supabase db push --file backend/docs/database-schema.sql\n')
    
    return false
  } else {
    console.log('\n✅ 所有表都已存在！')
    return true
  }
}

verifyTables()
  .then(success => {
    if (success) {
      console.log('\n✅ 数据库已就绪，可以启动后端服务')
      process.exit(0)
    } else {
      console.log('\n⚠️  请先创建缺失的表，然后重新运行此脚本验证')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('❌ 验证失败:', error)
    process.exit(1)
  })
