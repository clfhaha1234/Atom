import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from root .env file
const rootEnvPath = path.resolve(__dirname, '../../.env')
dotenv.config({ path: rootEnvPath })

import chatRoutes from './routes/chat'
import chatStreamRoutes from './routes/chat-stream'
import chatFixRoutes from './routes/chat-fix'
import authRoutes from './routes/auth'
import projectsRoutes from './routes/projects'
import messagesRoutes from './routes/messages'
import { supabase } from './lib/supabase'

const app = express()
const PORT = process.env.PORT || 3001
const isProduction = process.env.NODE_ENV === 'production'

app.use(cors())
app.use(express.json())

// Serve static frontend files in production
if (isProduction) {
  const frontendPath = path.join(__dirname, '../../frontend/dist')
  app.use(express.static(frontendPath))
}

// Routes
app.use('/api/chat', chatRoutes)
app.use('/api/chat', chatStreamRoutes)
app.use('/api/chat', chatFixRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/projects', projectsRoutes)
app.use('/api/messages', messagesRoutes)

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// 验证 Supabase 连接
async function verifySupabaseConnection() {
  if (!supabase) {
    console.warn('⚠️  Supabase 客户端未初始化')
    return false
  }
  
  try {
    // 尝试查询一个简单的表来验证连接
    const { error } = await supabase.from('projects').select('count').limit(1)
    if (error) {
      // 如果是表不存在，说明数据库未初始化，但不影响基本连接
      if (error.message.includes('Could not find the table') || 
          error.message.includes('does not exist')) {
        console.warn('⚠️  Supabase 连接正常，但数据库表未创建。请运行数据库迁移脚本。')
        console.warn('   提示: 检查 backend/docs/database-schema.sql')
        return true // 连接正常，只是表不存在
      }
      console.error('❌ Supabase 连接失败:', error.message)
      return false
    }
    console.log('✅ Supabase 连接成功')
    return true
  } catch (error) {
    console.error('❌ Supabase 连接测试异常:', error)
    return false
  }
}

// SPA fallback - serve index.html for all non-API routes in production
if (isProduction) {
  const frontendPath = path.join(__dirname, '../../frontend/dist')
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'))
  })
}

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📍 Environment: ${isProduction ? 'production' : 'development'}`)
  await verifySupabaseConnection()
})
