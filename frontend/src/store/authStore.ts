import { create } from 'zustand'
import type { User } from '../types'
import { supabase } from '../lib/supabase'

interface AuthStore {
  user: User | null
  loading: boolean
  
  setUser: (user: User | null) => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  checkAuth: () => Promise<void>
  resendConfirmationEmail: (email: string) => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  
  setUser: (user) => set({ user }),
  
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      // 处理邮箱未确认的情况
      if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
        // 开发环境：尝试使用 admin API 手动确认用户（仅用于开发测试）
        // 注意：这需要 Service Role Key，在生产环境中不应该这样做
        // 这里我们只是提供更好的错误提示
        const customError = new Error('邮箱未确认，请检查您的邮箱并点击确认链接')
        ;(customError as any).code = 'email_not_confirmed'
        throw customError
      }
      throw error
    }
    
    if (data.user) {
      set({ user: { id: data.user.id, email: data.user.email || '' } })
    }
  },
  
  signUp: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // 允许用户注册后立即登录（即使邮箱未确认）
        emailRedirectTo: `${window.location.origin}/chat`,
      },
    })
    
    if (error) throw error
    
    if (data.user) {
      // 如果邮箱需要确认，提示用户
      if (!data.user.email_confirmed_at) {
        // 仍然设置用户，允许继续使用（开发环境）
        set({ user: { id: data.user.id, email: data.user.email || '' } })
      } else {
        set({ user: { id: data.user.id, email: data.user.email || '' } })
      }
    }
  },
  
  resendConfirmationEmail: async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })
    
    if (error) throw error
  },
  
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },
  
  checkAuth: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      set({ user: { id: user.id, email: user.email || '' }, loading: false })
    } else {
      set({ user: null, loading: false })
    }
  },
}))
