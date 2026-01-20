export type Agent = 'mike' | 'emma' | 'bob' | 'alex'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  agent?: Agent
  content: string
  timestamp: Date
  artifacts?: Artifact[]
}

export interface SandboxInfo {
  sandboxId: string
  vncUrl?: string
  websiteUrl?: string
}

export interface ErrorInfo {
  type: 'syntax' | 'runtime' | 'deployment' | 'network' | 'unknown'
  message: string
  file?: string
  line?: number
  stack?: string
  timestamp: Date
}

export interface Artifact {
  id: string
  type: 'prd' | 'architecture' | 'code' | 'preview' | 'error'
  content: any
  title?: string
  sandboxInfo?: SandboxInfo
  errorInfo?: ErrorInfo
  fixable?: boolean
}

export interface Project {
  id: string
  name: string
  description: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface User {
  id: string
  email: string
  name?: string
}
