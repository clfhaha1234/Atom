import type { Message } from '../types'
import { Avatar } from './Avatar'
import ReactMarkdown from 'react-markdown'
import { ErrorMessage } from './ErrorMessage'
import { useChatStore } from '../store/chatStore'

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const fixError = useChatStore((state) => state.fixError)
  
  return (
    <div className={`flex gap-4 mb-6 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <Avatar 
          agent={message.agent} 
          className="flex-shrink-0"
        />
      )}
      
      <div className={`max-w-2xl rounded-2xl px-6 py-4 ${
        isUser 
          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white' 
          : 'bg-white border border-gray-200'
      }`}>
        {!isUser && message.agent && (
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold capitalize">{message.agent}</span>
            <span className="text-sm text-gray-500">
              {getAgentRole(message.agent)}
            </span>
          </div>
        )}
        
        <div className={isUser ? 'prose prose-invert max-w-none' : 'prose max-w-none'}>
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        
        {message.artifacts && message.artifacts.length > 0 && (
          <div className="mt-4 space-y-2">
            {message.artifacts.map((artifact) => {
              // 错误消息显示
              if (artifact.type === 'error' && artifact.errorInfo) {
                // 获取最新的代码上下文
                const getLatestCodeContext = (): Record<string, string> => {
                  const { messages } = useChatStore.getState()
                  const latestCodeArtifact = messages
                    .slice()
                    .reverse()
                    .flatMap(m => m.artifacts || [])
                    .find(a => a.type === 'code')
                  return latestCodeArtifact?.content || {}
                }

                return (
                  <ErrorMessage
                    key={artifact.id}
                    errorInfo={artifact.errorInfo}
                    fixable={artifact.fixable}
                    onFix={artifact.fixable ? async () => {
                      const codeContext = getLatestCodeContext()
                      await fixError(artifact.id, artifact.errorInfo!, codeContext)
                    } : undefined}
                  />
                )
              }
              
              // 代码预览在右侧显示，这里只显示其他类型的 artifact
              if (artifact.type === 'code') {
                return (
                  <div key={artifact.id} className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="text-sm font-semibold text-purple-700">💻 代码已生成</div>
                    <div className="text-xs text-purple-600 mt-1">查看右侧代码预览</div>
                  </div>
                )
              }
              return <ArtifactCard key={artifact.id} artifact={artifact} />
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function getAgentRole(agent: string): string {
  const roles: Record<string, string> = {
    mike: 'Team Leader',
    emma: 'Product Manager',
    bob: 'Architect',
    alex: 'Engineer',
  }
  return roles[agent] || 'Assistant'
}

function ArtifactCard({ artifact }: { artifact: any }) {
  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="text-sm font-semibold mb-2">{artifact.title || artifact.type}</div>
      {artifact.type === 'code' && (
        <pre className="text-xs overflow-x-auto">
          <code>{JSON.stringify(artifact.content, null, 2)}</code>
        </pre>
      )}
      {artifact.type === 'prd' && (
        <div className="text-sm whitespace-pre-wrap">{artifact.content}</div>
      )}
    </div>
  )
}
