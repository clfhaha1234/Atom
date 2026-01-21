import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { useMessageStore } from '../store/messageStore'
import { ChatMessage } from '../components/ChatMessage'
import { ChatInput } from '../components/ChatInput'
import { CodebaseView } from '../components/CodebaseView'
import { WebPreview } from '../components/WebPreview'

type ViewMode = 'codebase' | 'preview'

export function ChatPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messages, isTyping, addMessage, clearMessages, setMessages } = useChatStore()
  const { user, signOut, checkAuth } = useAuthStore()
  const { projects, currentProjectId, setCurrentProject, fetchProjects } = useProjectStore()
  const { fetchMessages } = useMessageStore()
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [messagesLoaded, setMessagesLoaded] = useState(false)
  
  const currentProject = projects.find(p => p.id === currentProjectId)

  // 获取最新的代码 artifact（优先显示最新的）
  const latestCodeArtifact = messages
    .slice()
    .reverse()
    .flatMap(m => m.artifacts || [])
    .find(a => a.type === 'code')

  useEffect(() => {
    checkAuth().then(async () => {
      if (!user) {
        navigate('/login')
        return
      }
      
      // 加载项目列表（对话历史）
      await fetchProjects(user.id)
      
      // 从 URL 参数获取项目 ID
      const projectIdFromUrl = searchParams.get('projectId')
      if (projectIdFromUrl) {
        setCurrentProject(projectIdFromUrl)
        
        // 加载该项目的消息历史
        if (!messagesLoaded) {
          setMessagesLoaded(true)
          const savedMessages = await fetchMessages(projectIdFromUrl, user.id)
          if (savedMessages.length > 0) {
            // 转换数据库格式到前端格式
            const formattedMessages = savedMessages.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              agent: msg.agent,
              timestamp: new Date(msg.timestamp),
              artifacts: msg.artifacts || [],
            }))
            setMessages(formattedMessages)
          } else {
            // 如果没有保存的消息，清空当前消息（可能是新项目）
            clearMessages()
          }
        }
      } else {
        // 新对话，清空消息和项目
        if (messages.length > 0 && !messages.some(msg => msg.id === 'welcome')) {
          clearMessages()
        }
        setCurrentProject(null)
        setMessagesLoaded(true)
      }
    })
  }, [user, navigate, checkAuth, fetchProjects, searchParams, setCurrentProject, fetchMessages, messagesLoaded, messages.length, clearMessages, setMessages])

  // 使用 useRef 跟踪是否已添加欢迎消息，避免重复添加
  const welcomeAddedRef = useRef(false)

  useEffect(() => {
    // 检查是否已经存在欢迎消息，或者已经添加过
    const hasWelcome = messages.some(msg => msg.id === 'welcome')
    
    // 如果有项目 ID，不显示欢迎消息（继续之前的对话）
    if (messages.length === 0 && !hasWelcome && !welcomeAddedRef.current && !currentProjectId) {
      welcomeAddedRef.current = true
      // 添加欢迎消息
      addMessage({
        id: 'welcome',
        role: 'assistant',
        agent: 'mike',
        content: `你好！我是 Mike，Atoms 团队的 Team Leader。\n\n我可以帮助你将想法转化为可运行的 Web 应用。只需要描述你的想法，我们的 AI 团队就会协作完成：\n\n- **Emma** (产品经理) 会分析需求并生成 PRD\n- **Bob** (架构师) 会设计技术架构\n- **Alex** (工程师) 会生成代码并部署\n\n告诉我你想做什么项目吧！`,
        timestamp: new Date(),
      })
    }
  }, [messages, addMessage, currentProjectId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  if (!user) {
    return null
  }


  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="max-w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Atoms
            </h1>
            {currentProject ? (
              <>
                <span className="text-sm text-gray-700 font-medium">{currentProject.name}</span>
                {latestCodeArtifact && (
                  <span className="text-sm text-green-600">✓ 代码已生成</span>
                )}
              </>
            ) : (
              <span className="text-sm text-gray-500">新对话</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/projects')}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              对话历史
            </button>
            {latestCodeArtifact?.sandboxInfo?.websiteUrl && (
              <a
                href={latestCodeArtifact.sandboxInfo.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                在新窗口打开
              </a>
            )}
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* Main Content: Chat + Code Visualization */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat Messages */}
        <div className="w-1/3 flex flex-col border-r border-gray-200 bg-white">
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="max-w-3xl mx-auto">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              
              {isTyping && (
                <div className="flex gap-4 mb-6">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white font-semibold">
                    M
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white">
            <ChatInput />
          </div>
        </div>

        {/* Right: Code Visualization */}
        {latestCodeArtifact ? (
          <div className="w-2/3 bg-white flex flex-col">
            {/* View Mode Tabs */}
            <div className="border-b border-gray-200 bg-gray-50">
              <div className="flex">
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    viewMode === 'preview'
                      ? 'border-purple-600 text-purple-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  🌐 预览
                </button>
                <button
                  onClick={() => setViewMode('codebase')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    viewMode === 'codebase'
                      ? 'border-purple-600 text-purple-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📁 代码库
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
              {viewMode === 'preview' ? (
                <WebPreview artifact={latestCodeArtifact} />
              ) : (
                <CodebaseView artifact={latestCodeArtifact} />
              )}
            </div>
          </div>
        ) : (
          <div className="w-2/3 bg-gray-50 flex items-center justify-center border-l border-gray-200">
            <div className="text-center text-gray-400">
              <div className="text-4xl mb-4">💻</div>
              <p className="text-lg mb-2">代码生成后将显示在这里</p>
              <p className="text-sm">描述你的想法，AI 团队会为你构建应用</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
