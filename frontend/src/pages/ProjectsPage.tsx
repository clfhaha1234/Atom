import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'

export function ProjectsPage() {
  const navigate = useNavigate()
  const { user, checkAuth } = useAuthStore()
  const { projects, loading, fetchProjects, deleteProject, setCurrentProject } = useProjectStore()

  useEffect(() => {
    checkAuth().then(() => {
      if (!user) {
        navigate('/login')
      } else {
        fetchProjects(user.id)
      }
    })
  }, [user, navigate, checkAuth, fetchProjects])

  const handleSelectProject = (projectId: string) => {
    setCurrentProject(projectId)
    // 清空当前消息，加载新项目的消息
    navigate(`/chat?projectId=${projectId}`)
  }

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation()
    if (!user) return
    
    if (!confirm('确定要删除这个对话吗？此操作不可恢复。')) {
      return
    }

    try {
      await deleteProject(projectId, user.id)
    } catch (error) {
      console.error('Failed to delete project:', error)
      alert('删除对话失败，请稍后重试')
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">对话历史</h1>
          <p className="text-purple-100">查看和管理你的所有对话</p>
        </div>

        {/* New Chat Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/chat')}
            className="px-6 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors shadow-lg"
          >
            + 新对话
          </button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="text-center text-white py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-4">加载中...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 text-center">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-2xl font-semibold text-white mb-2">还没有对话</h2>
            <p className="text-purple-100 mb-6">开始一个新对话，AI 团队会帮你构建应用！</p>
            <button
              onClick={() => navigate('/chat')}
              className="px-6 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
            >
              + 新对话
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleSelectProject(project.id)}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow cursor-pointer relative group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">{project.name}</h3>
                    {project.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{project.description}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDeleteProject(e, project.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 p-1"
                    title="删除对话"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                
                <div className="flex flex-col gap-2">
                  {project.lastMessage && (
                    <p className="text-sm text-gray-600 line-clamp-2 italic">
                      "{project.lastMessage.content}"
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      {project.hasCode ? (
                        <span className="text-green-600 font-medium">✓ 已生成代码</span>
                      ) : (
                        <span className="text-gray-400">进行中</span>
                      )}
                    </div>
                    <span>
                      {new Date(project.lastUpdated || project.updated_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
