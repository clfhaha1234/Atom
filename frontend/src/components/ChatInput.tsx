import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatStore } from '../store/chatStore'
import { useProjectStore } from '../store/projectStore'
import { useAuthStore } from '../store/authStore'
import { useMessageStore } from '../store/messageStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export function ChatInput() {
  const [input, setInput] = useState('')
  const navigate = useNavigate()
  const { addMessage, setTyping, isTyping } = useChatStore()
  const { currentProjectId, setCurrentProject, createProject } = useProjectStore()
  const { user } = useAuthStore()
  const { saveMessage } = useMessageStore()
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isTyping) return  // 如果正在处理，禁止提交
    
    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: input,
      timestamp: new Date(),
    }
    
    addMessage(userMessage)
    const messageContent = input
    setInput('')
    setTyping(true)
    
    // 如果没有当前项目，自动创建新项目（从第一条消息生成项目名）
    let projectId = currentProjectId
    if (!projectId && user) {
      // 从消息生成项目名称（取前30个字符）
      const projectName = messageContent.length > 30 
        ? messageContent.substring(0, 30) + '...'
        : messageContent
      try {
        const newProject = await createProject(user.id, projectName)
        projectId = newProject.id
        setCurrentProject(projectId)
        // 立即更新 URL，包含 projectId
        navigate(`/chat?projectId=${projectId}`, { replace: true })
      } catch (error) {
        console.error('Failed to create project:', error)
        // 如果创建失败，使用默认项目 ID
        projectId = 'default'
      }
    }
    
    // 保存用户消息到数据库
    if (projectId && user) {
      saveMessage(projectId, user.id, userMessage).catch(err => 
        console.error('Failed to save message:', err)
      )
    }
    
    try {
      // 获取对话历史（最近 10 条消息）
      const { messages } = useChatStore.getState()
      const conversationHistory = messages
        .slice(-10)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          agent: msg.agent,
        }))
      
      // 使用流式响应
      const response = await fetch(`${API_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: messageContent,
          projectId: projectId || 'default',
          userId: user?.id, // 传递用户 ID
          conversationHistory,
        }),
      })
      
      if (!response.body) {
        throw new Error('No response body')
      }
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let currentMessageId: string | null = null
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.type === 'start') {
                // 开始处理
                continue
              }
              
              if (data.type === 'agent_start') {
                // Agent 开始工作
                currentMessageId = Date.now().toString() + '-' + data.agent
                addMessage({
                  id: currentMessageId,
                  role: 'assistant',
                  agent: data.agent,
                  content: data.content,
                  timestamp: new Date(),
                })
              } else if (data.type === 'content_update') {
                // 实时更新内容（流式输出）
                const { updateMessage } = useChatStore.getState()
                if (currentMessageId) {
                  updateMessage(currentMessageId, {
                    content: data.content,
                  })
                } else {
                  // 如果没有当前消息，创建新消息
                  currentMessageId = Date.now().toString() + '-' + (data.agent || 'assistant')
                  addMessage({
                    id: currentMessageId,
                    role: 'assistant',
                    agent: data.agent,
                    content: data.content,
                    timestamp: new Date(),
                  })
                }
              } else if (data.type === 'agent_complete') {
                // Agent 完成工作，更新消息
                const { updateMessage } = useChatStore.getState()
                let finalMessage
                if (currentMessageId) {
                  updateMessage(currentMessageId, {
                    content: data.content,
                    artifacts: data.artifacts || [],
                  })
                  // 获取更新后的消息用于保存
                  const { messages } = useChatStore.getState()
                  finalMessage = messages.find(m => m.id === currentMessageId)
                } else {
                  finalMessage = {
                    id: Date.now().toString(),
                    role: 'assistant' as const,
                    agent: data.agent,
                    content: data.content,
                    timestamp: new Date(),
                    artifacts: data.artifacts,
                  }
                  addMessage(finalMessage)
                }
                // 保存消息到数据库（确保每次 AI 回复都保存）
                const currentProjectId = useProjectStore.getState().currentProjectId
                if (currentProjectId && user && finalMessage) {
                  saveMessage(currentProjectId, user.id, finalMessage).catch(err => 
                    console.error('Failed to save agent_complete message:', err)
                  )
                }
              } else if (data.type === 'complete') {
                // 全部完成
                const { updateMessage } = useChatStore.getState()
                let finalMessage
                if (currentMessageId) {
                  updateMessage(currentMessageId, {
                    content: data.content,
                    artifacts: data.artifacts || [],
                  })
                  // 获取更新后的消息用于保存
                  const { messages } = useChatStore.getState()
                  finalMessage = messages.find(m => m.id === currentMessageId)
                } else {
                  finalMessage = {
                    id: Date.now().toString(),
                    role: 'assistant' as const,
                    agent: data.agent,
                    content: data.content,
                    timestamp: new Date(),
                    artifacts: data.artifacts,
                  }
                  addMessage(finalMessage)
                }
                // 保存消息到数据库（确保每次 AI 回复都保存）
                const currentProjectId = useProjectStore.getState().currentProjectId
                if (currentProjectId && user && finalMessage) {
                  saveMessage(currentProjectId, user.id, finalMessage).catch(err => 
                    console.error('Failed to save complete message:', err)
                  )
                }
              } else if (data.type === 'error') {
                // 显示具体错误信息
                const errorMsg = data.error || data.message || '未知错误'
                addMessage({
                  id: Date.now().toString(),
                  role: 'assistant',
                  agent: 'mike',
                  content: `❌ **错误**: ${errorMsg}`,
                  timestamp: new Date(),
                })
              }
            } catch (err) {
              console.error('Parse error:', err)
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      
      // 提取具体错误信息
      let errorMessage = '发生未知错误'
      
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message)
      }
      
      // 如果是网络错误，提供更友好的提示
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
        errorMessage = `网络连接失败: ${errorMessage}。请检查网络连接或稍后重试。`
      } else if (errorMessage.includes('timeout')) {
        errorMessage = `请求超时: ${errorMessage}。请稍后重试。`
      } else if (errorMessage.includes('No response body')) {
        errorMessage = `服务器响应异常: 未收到响应数据。请稍后重试。`
      }
      
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        agent: 'mike',
        content: `❌ **错误**: ${errorMessage}`,
        timestamp: new Date(),
      })
    } finally {
      setTyping(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="p-6 border-t bg-white">
      <div className="max-w-4xl mx-auto flex gap-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isTyping) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
          disabled={isTyping}
          className={`flex-1 px-6 py-4 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 ${
            isTyping ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
          }`}
          placeholder={isTyping ? 'AI 正在处理中，请稍候...' : '描述你想做的项目...'}
          rows={1}
        />
        <button 
          type="submit"
          disabled={isTyping}
          className={`px-8 py-4 rounded-2xl font-semibold transition-opacity ${
            isTyping 
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
              : 'gradient-bg text-white hover:opacity-90'
          }`}
        >
          {isTyping ? '处理中...' : '发送'}
        </button>
      </div>
    </form>
  )
}
