import express from 'express'
import { createMikeAgent } from '../agents/mike'

const router = express.Router()

router.post('/', async (req, res) => {
  const { message, projectId } = req.body
  
  try {
    // 调用 Mike Agent
    const mike = createMikeAgent()
    const response = await mike.invoke({
      userMessage: message,
      projectId: projectId || 'default',
      userId: 'user-1', // TODO: 从认证中获取
    })
    
    res.json({
      id: response.id || Date.now().toString(),
      agent: response.agent || 'mike',
      content: response.content,
      artifacts: response.artifacts || [],
    })
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error))
    })
  }
})

export default router
