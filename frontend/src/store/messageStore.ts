import { create } from 'zustand'

// In production (same origin), use empty string for relative URLs
const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:3001')

interface MessageStore {
  fetchMessages: (projectId: string, userId: string) => Promise<any[]>
  saveMessage: (projectId: string, userId: string, message: any) => Promise<void>
  saveMessages: (projectId: string, userId: string, messages: any[]) => Promise<void>
}

export const useMessageStore = create<MessageStore>(() => ({
  fetchMessages: async (projectId: string, userId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/messages/${projectId}?userId=${userId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch messages')
      }
      const data = await response.json()
      return data.messages || []
    } catch (error) {
      console.error('Fetch messages error:', error)
      return []
    }
  },

  saveMessage: async (projectId: string, userId: string, message: any) => {
    try {
      await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          userId,
          message,
        }),
      })
    } catch (error) {
      console.error('Save message error:', error)
      // 静默失败，不影响用户体验
    }
  },

  saveMessages: async (projectId: string, userId: string, messages: any[]) => {
    try {
      await fetch(`${API_URL}/api/messages/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          userId,
          messages,
        }),
      })
    } catch (error) {
      console.error('Batch save messages error:', error)
      // 静默失败，不影响用户体验
    }
  },
}))
