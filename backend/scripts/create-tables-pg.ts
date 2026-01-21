/**
 * 使用 pg 库直接连接 Postgres 数据库创建表
 */

import { Client } from 'pg'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'

// Load from root .env file
dotenv.config({ path: resolve(__dirname, '../../.env') })

// 从环境变量获取数据库连接信息
const supabaseUrl = process.env.SUPABASE_URL || ''
const dbPassword = process.env.SUPABASE_DB_PASSWORD || ''
const dbConnectionString = process.env.SUPABASE_DB_CONNECTION_STRING || ''

// 从 Supabase URL 提取项目引用
function extractProjectRef(url: string): string | null {
  const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/)
  return match ? match[1] : null
}

async function createTables() {
  console.log('🔄 开始创建数据库表...\n')
  
  let client: Client | null = null
  
  try {
    // 尝试使用连接字符串
    if (dbConnectionString) {
      console.log('📡 使用连接字符串连接数据库...')
      client = new Client({
        connectionString: dbConnectionString,
        ssl: { rejectUnauthorized: false }
      })
    } else if (dbPassword) {
      // 从 Supabase URL 提取项目引用
      const projectRef = extractProjectRef(supabaseUrl)
      if (!projectRef) {
        throw new Error('无法从 SUPABASE_URL 提取项目引用')
      }
      
      console.log(`📡 连接到数据库 (项目: ${projectRef})...`)
      client = new Client({
        host: `db.${projectRef}.supabase.co`,
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: dbPassword,
        ssl: { rejectUnauthorized: false }
      })
    } else {
      throw new Error('需要设置 SUPABASE_DB_PASSWORD 或 SUPABASE_DB_CONNECTION_STRING')
    }
    
    // 连接数据库
    await client.connect()
    console.log('✅ 数据库连接成功\n')
    
    // 读取 SQL 文件
    const sqlPath = join(__dirname, 'setup-database.sql')
    const sql = readFileSync(sqlPath, 'utf-8')
    
    // 执行 SQL
    console.log('📝 执行 SQL 语句...\n')
    await client.query(sql)
    
    console.log('✅ SQL 执行成功\n')
    
    // 验证表是否创建成功
    console.log('🔍 验证表是否创建成功...\n')
    
    const tables = ['projects', 'project_states', 'messages']
    for (const tableName of tables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [tableName])
      
      if (result.rows[0].exists) {
        console.log(`  ✅ 表 ${tableName} 存在`)
      } else {
        console.log(`  ❌ 表 ${tableName} 不存在`)
      }
    }
    
    console.log('\n✅ 表创建完成！')
    
  } catch (error: any) {
    console.error('\n❌ 创建表失败:', error.message)
    
    if (error.message.includes('password authentication failed') || 
        error.message.includes('authentication failed')) {
      console.log('\n💡 提示:')
      console.log('   1. 检查数据库密码是否正确')
      console.log('   2. 在 .env 文件中设置 SUPABASE_DB_PASSWORD')
      console.log('   3. 或者在 Supabase Dashboard -> Settings -> Database 获取密码')
    } else if (error.message.includes('ECONNREFUSED') || 
               error.message.includes('ENOTFOUND')) {
      console.log('\n💡 提示:')
      console.log('   1. 检查网络连接')
      console.log('   2. 确认 Supabase 项目已启用数据库访问')
      console.log('   3. 检查防火墙设置')
    } else if (error.message.includes('需要设置')) {
      console.log('\n💡 提示:')
      console.log('   在 .env 文件中添加以下之一:')
      console.log('   SUPABASE_DB_PASSWORD=your_password')
      console.log('   或')
      console.log('   SUPABASE_DB_CONNECTION_STRING=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres')
    }
    
    process.exit(1)
  } finally {
    if (client) {
      await client.end()
    }
  }
}

createTables().catch(error => {
  console.error('❌ 执行失败:', error)
  process.exit(1)
})
