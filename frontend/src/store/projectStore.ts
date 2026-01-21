import { create } from 'zustand'

export interface Project {
  id: string
  user_id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
  hasCode?: boolean
  lastUpdated?: string
  lastMessage?: {
    content: string
    role: string
    timestamp: string
  }
}

interface ProjectStore {
  projects: Project[]
  currentProjectId: string | null
  loading: boolean
  setCurrentProject: (projectId: string | null) => void
  fetchProjects: (userId: string) => Promise<void>
  createProject: (userId: string, name: string, description?: string) => Promise<Project>
  updateProject: (projectId: string, userId: string, name?: string, description?: string) => Promise<void>
  deleteProject: (projectId: string, userId: string) => Promise<void>
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProjectId: null,
  loading: false,

  setCurrentProject: (projectId) => {
    set({ currentProjectId: projectId })
    // 保存到 localStorage
    if (projectId) {
      localStorage.setItem('currentProjectId', projectId)
    } else {
      localStorage.removeItem('currentProjectId')
    }
  },

  fetchProjects: async (userId) => {
    set({ loading: true })
    try {
      const response = await fetch(`${API_URL}/api/projects?userId=${userId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch projects')
      }
      const data = await response.json()
      set({ projects: data.projects || [], loading: false })
      
      // 恢复当前项目
      const savedProjectId = localStorage.getItem('currentProjectId')
      if (savedProjectId && data.projects?.some((p: Project) => p.id === savedProjectId)) {
        set({ currentProjectId: savedProjectId })
      }
    } catch (error) {
      console.error('Fetch projects error:', error)
      set({ loading: false })
    }
  },

  createProject: async (userId, name, description) => {
    try {
      const response = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, name, description }),
      })
      if (!response.ok) {
        throw new Error('Failed to create project')
      }
      const data = await response.json()
      const newProject = data.project
      
      set((state) => ({
        projects: [newProject, ...state.projects],
        currentProjectId: newProject.id,
      }))
      
      // 保存到 localStorage
      localStorage.setItem('currentProjectId', newProject.id)
      
      return newProject
    } catch (error) {
      console.error('Create project error:', error)
      throw error
    }
  },

  updateProject: async (projectId, userId, name, description) => {
    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, name, description }),
      })
      if (!response.ok) {
        throw new Error('Failed to update project')
      }
      const data = await response.json()
      
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId ? { ...p, ...data.project } : p
        ),
      }))
    } catch (error) {
      console.error('Update project error:', error)
      throw error
    }
  },

  deleteProject: async (projectId, userId) => {
    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}?userId=${userId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete project')
      }
      
      set((state) => {
        const newProjects = state.projects.filter((p) => p.id !== projectId)
        const newCurrentProjectId =
          state.currentProjectId === projectId
            ? newProjects.length > 0
              ? newProjects[0].id
              : null
            : state.currentProjectId
        
        if (!newCurrentProjectId) {
          localStorage.removeItem('currentProjectId')
        } else {
          localStorage.setItem('currentProjectId', newCurrentProjectId)
        }
        
        return {
          projects: newProjects,
          currentProjectId: newCurrentProjectId,
        }
      })
    } catch (error) {
      console.error('Delete project error:', error)
      throw error
    }
  },
}))
