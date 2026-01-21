/**
 * 尝试直接通过 Supabase 连接创建表
 * 如果无法直接执行，会提供详细的创建步骤
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

async function createTables() {
  console.log('🔄 尝试创建数据库表...\n')
  
  // 读取 SQL 文件
  const sqlPath = join(__dirname, '../docs/database-schema.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  
  // 由于 Supabase REST API 不支持直接执行 SQL，我们需要通过其他方式
  // 尝试使用 RPC 函数（如果存在）
  console.log('📋 Supabase REST API 不支持直接执行 SQL')
  console.log('   需要使用以下方式之一创建表:\n')
  
  console.log('='.repeat(60))
  console.log('方法 1: 使用 Supabase Dashboard（推荐）')
  console.log('='.repeat(60))
  console.log('1. 打开: https://supabase.com/dashboard')
  console.log('2. 选择你的项目')
  console.log('3. 点击左侧菜单的 "SQL Editor"')
  console.log('4. 点击 "New query"')
  console.log('5. 复制下面的 SQL 代码并执行\n')
  
  console.log('SQL 代码:')
  console.log('-'.repeat(60))
  console.log(sql)
  console.log('-'.repeat(60))
  console.log()
  
  // 验证表是否已存在
  console.log('='.repeat(60))
  console.log('检查表状态...')
  console.log('='.repeat(60))
  console.log()
  
  const tables = ['projects', 'project_states', 'messages']
  let allExist = true
  
  for (const tableName of tables) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1)
    
    if (error) {
      if (error.message.includes('Could not find the table') || 
          error.message.includes('does not exist')) {
        console.log(`  ❌ 表 ${tableName} 不存在`)
        allExist = false
      } else {
        console.log(`  ⚠️  表 ${tableName} 检查失败: ${error.message}`)
      }
    } else {
      console.log(`  ✅ 表 ${tableName} 已存在`)
    }
  }
  
  console.log()
  
  if (allExist) {
    console.log('✅ 所有表都已存在！')
    return true
  } else {
    console.log('❌ 部分表不存在，请按照上面的步骤创建表')
    console.log()
    console.log('='.repeat(60))
    console.log('方法 2: 使用 Supabase CLI（如果已安装）')
    console.log('='.repeat(60))
    console.log('1. 安装 Supabase CLI: npm install -g supabase')
    console.log('2. 登录: supabase login')
    console.log('3. 链接项目: supabase link --project-ref <your-project-ref>')
    console.log('4. 执行 SQL: supabase db push --file backend/docs/database-schema.sql')
    console.log()
    
    // 保存 SQL 到临时文件，方便复制
    const tempSqlPath = join(__dirname, '../temp-create-tables.sql')
    require('fs').writeFileSync(tempSqlPath, sql)
    console.log(`📄 SQL 已保存到: ${tempSqlPath}`)
    console.log('   你可以直接复制这个文件的内容到 Supabase Dashboard')
    console.log()
    
    return false
  }
}

createTables()
  .then(success => {
    if (success) {
      console.log('✅ 数据库表已就绪')
      process.exit(0)
    } else {
      console.log('⚠️  请先创建表，然后重新运行此脚本验证')
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('❌ 执行失败:', error)
    process.exit(1)
  })
