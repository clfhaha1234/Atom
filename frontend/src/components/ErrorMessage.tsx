import { useState } from 'react'
import type { ErrorInfo } from '../types'

interface ErrorMessageProps {
  errorInfo: ErrorInfo
  onFix?: () => Promise<void>
  fixable?: boolean
}

export function ErrorMessage({ errorInfo, onFix, fixable = true }: ErrorMessageProps) {
  const [isFixing, setIsFixing] = useState(false)
  const [fixResult, setFixResult] = useState<'success' | 'failed' | null>(null)

  const getErrorIcon = (type: string) => {
    switch (type) {
      case 'syntax':
        return '🔴'
      case 'runtime':
        return '⚠️'
      case 'deployment':
        return '🚀'
      case 'network':
        return '🌐'
      default:
        return '❌'
    }
  }

  const getErrorTypeLabel = (type: string) => {
    switch (type) {
      case 'syntax':
        return '语法错误'
      case 'runtime':
        return '运行时错误'
      case 'deployment':
        return '部署错误'
      case 'network':
        return '网络错误'
      default:
        return '未知错误'
    }
  }

  const handleFix = async () => {
    if (!onFix || !fixable) return

    setIsFixing(true)
    setFixResult(null)

    try {
      await onFix()
      setFixResult('success')
    } catch (error) {
      console.error('Fix error:', error)
      setFixResult('failed')
    } finally {
      setIsFixing(false)
    }
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{getErrorIcon(errorInfo.type)}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-red-800">
              {getErrorTypeLabel(errorInfo.type)}
            </span>
            {errorInfo.file && (
              <span className="text-sm text-red-600">
                {errorInfo.file}
                {errorInfo.line && `:${errorInfo.line}`}
              </span>
            )}
          </div>
          
          <div className="text-sm text-red-700 mb-3 whitespace-pre-wrap">
            {errorInfo.message}
          </div>

          {errorInfo.stack && (
            <details className="mb-3">
              <summary className="text-xs text-red-600 cursor-pointer hover:text-red-800">
                查看堆栈信息
              </summary>
              <pre className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded overflow-auto max-h-40">
                {errorInfo.stack}
              </pre>
            </details>
          )}

          {fixable && onFix && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleFix}
                disabled={isFixing}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isFixing
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {isFixing ? '正在修复...' : '🔧 修复'}
              </button>
              
              {fixResult === 'success' && (
                <span className="text-sm text-green-600">✅ 修复成功</span>
              )}
              {fixResult === 'failed' && (
                <span className="text-sm text-red-600">❌ 修复失败，请重试</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
