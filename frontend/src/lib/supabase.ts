import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// 如果配置不完整，创建一个 mock 客户端避免错误
let supabase: ReturnType<typeof createClient>
try {
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey)
  } else {
    // 创建一个 mock 客户端
    supabase = createClient('https://placeholder.supabase.co', 'placeholder-key')
    console.warn('⚠️ Supabase 配置不完整，使用 placeholder')
  }
} catch (error) {
  console.error('Supabase 初始化错误:', error)
  // 创建一个基本的 mock
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key')
}

export { supabase }
