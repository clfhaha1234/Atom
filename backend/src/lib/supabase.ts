import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// 确保从正确的路径加载环境变量
const envPath = path.resolve(__dirname, '../../.env')
dotenv.config({ path: envPath })

// 读取环境变量
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// 如果 Service Role Key 未设置，使用 Anon Key 作为后备（仅用于开发）
const supabaseKey = supabaseServiceKey || process.env.SUPABASE_ANON_KEY || ''

// 检查配置完整性
const isConfigured = !!(supabaseUrl && supabaseKey)

if (!isConfigured) {
  console.warn('⚠️  Supabase 配置不完整，某些功能可能无法使用')
  console.warn('   请检查环境变量: SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  console.warn(`   .env 路径: ${envPath}`)
} else {
  console.log('✅ Supabase 配置已加载')
}

// 创建 Supabase 客户端（仅在配置完整时）
let supabase: SupabaseClient | null = null

if (isConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  } catch (error) {
    console.error('❌ 创建 Supabase 客户端失败:', error)
    supabase = null
  }
}

export { supabase }
