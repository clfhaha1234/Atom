import type { Agent } from '../types'

interface AvatarProps {
  agent?: Agent
  className?: string
}

const agentColors: Record<Agent, string> = {
  mike: 'bg-gradient-to-br from-purple-500 to-purple-700',
  emma: 'bg-gradient-to-br from-pink-500 to-pink-700',
  bob: 'bg-gradient-to-br from-blue-500 to-blue-700',
  alex: 'bg-gradient-to-br from-green-500 to-green-700',
}

const agentNames: Record<Agent, string> = {
  mike: 'Mike',
  emma: 'Emma',
  bob: 'Bob',
  alex: 'Alex',
}

export function Avatar({ agent, className = '' }: AvatarProps) {
  if (!agent) {
    return (
      <div className={`w-10 h-10 rounded-full bg-gray-300 ${className}`} />
    )
  }

  return (
    <div
      className={`w-10 h-10 rounded-full ${agentColors[agent]} flex items-center justify-center text-white font-semibold ${className}`}
      title={agentNames[agent]}
    >
      {agentNames[agent][0]}
    </div>
  )
}
