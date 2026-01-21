/**
 * 尝试通过 Supabase API 自动创建表
 * 使用 Service Role Key 尝试不同的方法
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

async function tryCreateTablesViaRPC() {
  console.log('🔄 尝试方法 1: 通过 RPC 函数执行 SQL...\n')
  
  // 首先尝试创建一个可以执行 SQL 的 RPC 函数
  // 注意：这需要先在 Supabase Dashboard 中创建一个函数
  // 但由于表还不存在，我们需要先创建一个可以执行任意 SQL 的函数
  
  const createFunctionSQL = `
CREATE OR REPLACE FUNCTION public.exec_sql(sql_text text)
RETURNS void AS $$
BEGIN
  EXECUTE sql_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`
  
  try {
    // 尝试通过 RPC 创建函数（如果不存在）
    // 但这个方法需要先在 Dashboard 中手动创建这个函数
    console.log('⚠️  需要通过 Supabase Dashboard 先创建一个 RPC 函数')
    console.log('   这一步无法自动完成，需要手动操作')
    return false
  } catch (error) {
    console.log('❌ RPC 方法不可用')
    return false
  }
}

async function createTablesManually() {
  console.log('\n📋 由于 Supabase API 限制，无法直接通过 API 创建表')
  console.log('   需要使用 Supabase Dashboard 手动执行 SQL\n')
  
  // 读取 SQL 文件
  const sqlPath = join(__dirname, '../docs/database-schema.sql')
  const sql = readFileSync(sqlPath, 'utf-8')
  
  console.log('='.repeat(60))
  console.log('🚀 快速创建表的步骤')
  console.log('='.repeat(60))
  console.log()
  console.log('1. 打开浏览器，访问: https://supabase.com/dashboard')
  console.log('2. 选择你的项目（项目 ID: nrxrajrpcbdzsbvzrhfl）')
  console.log('3. 点击左侧菜单的 "SQL Editor"')
  console.log('4. 点击 "New query"')
  console.log('5. 复制下面的 SQL 代码')
  console.log('6. 粘贴到 SQL Editor 中')
  console.log('7. 点击 "Run" 执行')
  console.log()
  console.log('='.repeat(60))
  console.log('📝 SQL 代码（复制从这里开始）')
  console.log('='.repeat(60))
  console.log()
  console.log(sql)
  console.log()
  console.log('='.repeat(60))
  console.log('（复制到这里结束）')
  console.log('='.repeat(60))
  console.log()
  
  // 保存到临时文件
  const tempPath = join(__dirname, '../temp-create-tables.sql')
  require('fs').writeFileSync(tempPath, sql)
  console.log(`✅ SQL 已保存到: ${tempPath}`)
  console.log('   你可以直接打开这个文件复制内容')
  console.log()
  
  return false
}

async function verifyTables() {
  console.log('🔍 验证表是否已创建...\n')
  
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
      console.log(`  ✅ 表 ${tableName} 存在`)
    }
  }
  
  return allExist
}

async function main() {
  console.log('='.repeat(60))
  console.log('🚀 自动创建 Supabase 数据库表')
  console.log('='.repeat(60))
  console.log()
  
  // 先检查表是否已存在
  const alreadyExists = await verifyTables()
  if (alreadyExists) {
    console.log('\n✅ 所有表都已存在！无需创建。')
    process.exit(0)
  }
  
  console.log('\n❌ 表不存在，需要创建\n')
  
  // 尝试通过 RPC（如果可能）
  const rpcSuccess = await tryCreateTablesViaRPC()
  
  if (!rpcSuccess) {
    // 提供手动创建的详细步骤
    await createTablesManually()
    
    console.log('\n⏳ 等待你完成表的创建...')
    console.log('   创建完成后，运行以下命令验证:')
    console.log('   npx ts-node scripts/verify-and-setup.ts')
    console.log()
    
    process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ 执行失败:', error)
  process.exit(1)
})
