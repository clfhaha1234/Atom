import express from 'express'
import { createMikeAgent } from '../agents/mike'

const router = express.Router()

// 流式响应端点
router.post('/stream', async (req, res) => {
  const { message, projectId, conversationHistory } = req.body
  
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('X-Accel-Buffering', 'no') // 禁用 nginx 缓冲
  
  try {
    const mike = createMikeAgent()
    
    // 执行完整工作流并流式返回
    const state = {
      userMessage: message,
      projectId: projectId || 'default',
      userId: 'user-1', // TODO: 从认证中获取
      conversationHistory: conversationHistory || [], // 传递对话历史
    }
    
    // 调用流式工作流
    for await (const chunk of mike.invokeStream(state)) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`)
      // 确保数据立即发送
      if (res.flushHeaders) {
        res.flushHeaders()
      }
    }
    
    // 发送完成消息
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
    res.end()
  } catch (error) {
    console.error('Stream error:', error)
    
    // 提取详细错误信息
    let errorMessage = '未知错误'
    let errorDetails = ''
    
    if (error instanceof Error) {
      errorMessage = error.message
      errorDetails = error.stack || ''
    } else if (typeof error === 'string') {
      errorMessage = error
    } else if (error && typeof error === 'object') {
      errorMessage = (error as any).message || JSON.stringify(error)
      errorDetails = (error as any).stack || ''
    }
    
    // 如果是 API 相关错误，提供更具体的提示
    if (errorMessage.includes('ANTHROPIC_API_KEY')) {
      errorMessage = 'Anthropic API 密钥未配置或无效。请检查环境变量 ANTHROPIC_API_KEY。'
    } else if (errorMessage.includes('Supabase') || errorMessage.includes('supabase')) {
      errorMessage = `数据库连接错误: ${errorMessage}。请检查 Supabase 配置。`
    } else if (errorMessage.includes('timeout')) {
      errorMessage = `请求超时: ${errorMessage}。可能是网络问题或服务响应慢。`
    }
    
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      error: errorMessage,
      details: errorDetails ? errorDetails.substring(0, 500) : undefined, // 限制详情长度
    })}\n\n`)
    res.end()
  }
})

export default router
