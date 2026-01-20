import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false)
  const navigate = useNavigate()
  const signIn = useAuthStore((state) => state.signIn)
  const resendConfirmationEmail = useAuthStore((state) => state.resendConfirmationEmail)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setEmailNotConfirmed(false)
    setLoading(true)

    try {
      await signIn(email, password)
      navigate('/chat')
    } catch (err: any) {
      if (err.code === 'email_not_confirmed' || err.message.includes('邮箱未确认')) {
        setEmailNotConfirmed(true)
        setError('邮箱未确认。请检查您的邮箱并点击确认链接，或点击下方按钮重新发送确认邮件。')
      } else {
        setError(err.message || '登录失败，请检查邮箱和密码')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResendEmail = async () => {
    if (!email) {
      setError('请先输入邮箱地址')
      return
    }
    
    setResending(true)
    setError('')
    
    try {
      await resendConfirmationEmail(email)
      setError('')
      alert('确认邮件已重新发送，请检查您的邮箱（包括垃圾邮件文件夹）')
    } catch (err: any) {
      setError(err.message || '发送确认邮件失败，请稍后重试')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Atoms</h1>
          <p className="text-gray-600">登录你的账户</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className={`px-4 py-3 rounded-lg ${
              emailNotConfirmed 
                ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' 
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <div className="mb-2">{error}</div>
              {emailNotConfirmed && (
                <button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={resending}
                  className="text-sm underline hover:no-underline font-semibold"
                >
                  {resending ? '发送中...' : '重新发送确认邮件'}
                </button>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 gradient-bg text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            还没账号？{' '}
            <Link to="/signup" className="text-purple-600 font-semibold hover:underline">
              立即注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
