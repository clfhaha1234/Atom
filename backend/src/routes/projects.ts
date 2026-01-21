import express from 'express'
import { supabase } from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router()

// 获取用户的所有项目
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId as string
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' })
    }

    // 在 null 检查后，保存引用以便 TypeScript 正确推断类型
    const db = supabase

    // 获取项目列表
    const { data: projects, error: projectsError } = await db
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (projectsError) {
      // 如果表不存在，返回空数组
      if (projectsError.code === 'PGRST116' || projectsError.message?.includes('does not exist')) {
        return res.json({ projects: [] })
      }
      throw projectsError
    }

    // 获取每个项目的最新状态和最后一条消息
    const projectsWithState = await Promise.all(
      (projects || []).map(async (project: any) => {
        // 获取项目状态
        const { data: stateData } = await db
          .from('project_states')
          .select('state, updated_at')
          .eq('project_id', project.id)
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // 获取最后一条消息（作为对话预览）
        const { data: lastMessage } = await db
          .from('messages')
          .select('content, role, timestamp')
          .eq('project_id', project.id)
          .eq('user_id', userId)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle()

        return {
          ...project,
          hasCode: !!(stateData?.state?.code && Object.keys(stateData.state.code).length > 0),
          lastUpdated: stateData?.updated_at || project.updated_at,
          lastMessage: lastMessage ? {
            content: lastMessage.content.substring(0, 100) + (lastMessage.content.length > 100 ? '...' : ''),
            role: lastMessage.role,
            timestamp: lastMessage.timestamp,
          } : null,
        }
      })
    )

    res.json({ projects: projectsWithState })
  } catch (error) {
    console.error('Get projects error:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get projects' 
    })
  }
})

// 创建新项目
router.post('/', async (req, res) => {
  try {
    const { userId, name, description } = req.body

    if (!userId || !name) {
      return res.status(400).json({ error: 'userId and name are required' })
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' })
    }

    const projectId = uuidv4()

    const { data, error } = await supabase
      .from('projects')
      .insert({
        id: projectId,
        user_id: userId,
        name: name.trim(),
        description: description?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      // 如果表不存在，返回错误提示
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return res.status(500).json({ 
          error: 'Projects table does not exist. Please run database migration.' 
        })
      }
      throw error
    }

    res.json({ project: data })
  } catch (error) {
    console.error('Create project error:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create project' 
    })
  }
})

// 获取单个项目
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
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return res.status(404).json({ error: 'Project not found' })
      }
      throw error
    }

    res.json({ project: data })
  } catch (error) {
    console.error('Get project error:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get project' 
    })
  }
})

// 更新项目
router.put('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params
    const { userId, name, description } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null

    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return res.status(404).json({ error: 'Project not found' })
      }
      throw error
    }

    res.json({ project: data })
  } catch (error) {
    console.error('Update project error:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to update project' 
    })
  }
})

// 删除项目
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

    // 删除项目状态
    await supabase
      .from('project_states')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)

    // 删除项目
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', userId)

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return res.status(404).json({ error: 'Project not found' })
      }
      throw error
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Delete project error:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to delete project' 
    })
  }
})

export default router
