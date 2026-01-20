import { useNavigate } from 'react-router-dom'

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl font-bold text-white mb-6">
            Turn ideas into products that sell
          </h1>
          <p className="text-xl text-purple-100 mb-12">
            AI 驱动的快速构建平台，无需编码即可将想法转化为可运行的 Web 应用
          </p>
          
          <div className="bg-white rounded-2xl p-8 mb-12 shadow-2xl">
            <button
              onClick={() => navigate('/signup')}
              className="w-full py-4 gradient-bg text-white rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity"
            >
              开始使用
            </button>
            <p className="text-sm text-gray-500 mt-4 text-center">
              注册后即可开始描述你的想法，AI 团队会实时为你构建应用
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-white">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-2">快速构建</h3>
              <p className="text-purple-100">3-5 分钟即可完成应用原型</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold mb-2">AI 团队</h3>
              <p className="text-purple-100">6 个专业智能体协作开发</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold mb-2">一键部署</h3>
              <p className="text-purple-100">自动化部署到生产环境</p>
            </div>
          </div>

          <div className="mt-16 text-purple-100">
            <p>已帮助 1000+ 创业者验证想法</p>
          </div>
        </div>
      </div>
    </div>
  )
}
