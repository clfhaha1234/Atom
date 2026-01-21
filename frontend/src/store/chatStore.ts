import { create } from 'zustand'
import type { Message, Project } from '../types'

interface ChatStore {
  messages: Message[]
  isTyping: boolean
  currentProject: Project | null

  addMessage: (message: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
  setMessages: (messages: Message[]) => void
  setTyping: (isTyping: boolean) => void
  setCurrentProject: (project: Project | null) => void
  clearChat: () => void
  clearMessages: () => void
  fixError: (errorId: string, errorInfo: any, codeContext: Record<string, string>) => Promise<void>
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isTyping: false,
  currentProject: null,
  
  addMessage: (message) => 
    set((state) => ({ 
      messages: [...state.messages, message] 
    })),
  
  updateMessage: (id: string, updates: Partial<Message>) =>
    set((state) => ({
      messages: state.messages.map(msg => 
        msg.id === id ? { ...msg, ...updates } : msg
      )
    })),
  
  setMessages: (messages) => set({ messages }),
    
  setTyping: (isTyping) => set({ isTyping }),
  
  setCurrentProject: (project) => set({ currentProject: project }),
  
  clearChat: () => set({ messages: [] }),
  clearMessages: () => set({ messages: [] }),

  fixError: async (errorId, errorInfo, codeContext) => {
    // In production (same origin), use empty string for relative URLs
    const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:3001')
    
    // 动态导入避免循环依赖
    const { useAuthStore } = await import('./authStore')
    const { user } = useAuthStore.getState()
    
    try {
      const response = await fetch(`${API_URL}/api/chat/fix-error`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errorId,
          errorInfo,
          codeContext,
          userId: user?.id, // 传递用户 ID
        }),
      })

      const data = await response.json()

      if (data.success && data.fixedCode) {
        // 添加修复成功的消息
        const fixMessage: Message = {
          id: `fix-${Date.now()}`,
          role: 'assistant',
          agent: 'alex',
          content: `✅ 错误已修复！\n\n${data.explanation || '代码已更新'}`,
          timestamp: new Date(),
          artifacts: [{
            id: `fixed-code-${Date.now()}`,
            type: 'code',
            content: data.fixedCode,
            title: '修复后的代码',
          }],
        }

        set((state) => ({
          messages: [...state.messages, fixMessage]
        }))
      } else {
        const errorMsg = data.message || data.error || '修复失败'
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('Fix error:', error)
      const errorMsg = error instanceof Error ? error.message : (typeof error === 'string' ? error : '修复失败')
      throw new Error(errorMsg)
    }
  },
}))
