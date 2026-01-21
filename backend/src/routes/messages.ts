import express from 'express'
import { supabase } from '../lib/supabase'

const router = express.Router()

// 获取项目的所有消息（对话历史）
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params
    const userId = req.query.userId as string

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' })
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('timestamp', { ascending: true })

    if (error) {
      // 如果表不存在，返回空数组
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return res.json({ messages: [] })
      }
      throw error
    }

    res.json({ messages: data || [] })
  } catch (error) {
    console.error('Get messages error:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get messages' 
    })
  }
})

// 保存消息
router.post('/', async (req, res) => {
  try {
    const { projectId, userId, message } = req.body

    if (!projectId || !userId || !message) {
      return res.status(400).json({ error: 'projectId, userId, and message are required' })
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' })
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        id: message.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        project_id: projectId,
        user_id: userId,
        role: message.role,
        content: message.content,
        agent: message.agent || null,
        artifacts: message.artifacts || null,
        timestamp: message.timestamp || new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      // 如果表不存在，只记录警告
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        console.warn('messages table does not exist yet, please run database migration')
        return res.json({ message: data || message })
      }
      throw error
    }

    res.json({ message: data })
  } catch (error) {
    console.error('Save message error:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to save message' 
    })
  }
})

// 批量保存消息
router.post('/batch', async (req, res) => {
  try {
    const { projectId, userId, messages } = req.body

    if (!projectId || !userId || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'projectId, userId, and messages array are required' })
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' })
    }

    const messagesToInsert = messages.map((msg: any) => ({
      id: msg.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      project_id: projectId,
      user_id: userId,
      role: msg.role,
      content: msg.content,
      agent: msg.agent || null,
      artifacts: msg.artifacts || null,
      timestamp: msg.timestamp || new Date().toISOString(),
    }))

    const { data, error } = await supabase
      .from('messages')
      .insert(messagesToInsert)
      .select()

    if (error) {
      // 如果表不存在，只记录警告
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        console.warn('messages table does not exist yet, please run database migration')
        return res.json({ messages: messages })
      }
      throw error
    }

    res.json({ messages: data || messages })
  } catch (error) {
    console.error('Batch save messages error:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to save messages' 
    })
  }
})

// 删除项目的所有消息
router.delete('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params
    const userId = req.query.userId as string

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' })
    }

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return res.json({ success: true })
      }
      throw error
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Delete messages error:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to delete messages' 
    })
  }
})

export default router
