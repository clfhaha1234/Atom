import OpenAI from 'openai'
import { supabase } from '../lib/supabase'

interface ProjectState {
  userMessage: string
  currentStatus: 'planning' | 'designing' | 'coding' | 'deploying' | 'complete' | 'chatting'
  prd?: string
  architecture?: string
  code?: Record<string, string>
  nextAgent?: 'emma' | 'bob' | 'alex' | 'mike' | 'complete'
  conversationHistory?: Array<{ role: 'user' | 'assistant', content: string, agent?: string }>
  isModification?: boolean // 标记是否为修改需求
  intent?: 'new_project' | 'code_optimization' | 'chat' // 用户意图
  originalUserMessage?: string // 保存原始用户需求，用于修复时区分原始需求和错误信息
}

interface AgentResponse {
  id: string
  agent: 'mike' | 'emma' | 'bob' | 'alex'
  content: string
  artifacts?: any[]
}

// 延迟初始化 client
let client: OpenAI | null = null

// Gemini API 配置
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview'

function getClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: GEMINI_API_KEY,
      baseURL: GEMINI_BASE_URL,
    })
    console.log(`✅ 使用 Gemini 模型 (Official SDK): ${GEMINI_MODEL}`)
  }
  return client
}

// 意图分析结果接口
interface IntentAnalysis {
  intent: 'new_project' | 'code_optimization' | 'chat'
  needsCodeFix: boolean  // 是否需要修复/修改现有代码
  reason: string         // 判断理由
}

// 意图理解：使用结构化 JSON 返回判断用户意图
async function detectIntent(state: ProjectState): Promise<IntentAnalysis> {
  const hasExistingProject = !!(state.prd || state.architecture || state.code)
  const hasCode = !!(state.code && Object.keys(state.code).length > 0)
  
  const prompt = `分析用户消息的意图，返回结构化 JSON。

用户消息: "${state.userMessage}"
项目状态: ${hasExistingProject ? '已有项目（PRD/架构/代码已存在）' : '新项目（无现有代码）'}
${hasCode ? `现有代码文件: ${Object.keys(state.code!).join(', ')}` : ''}

请分析并返回 JSON（只返回 JSON，不要其他内容）：
{
  "intent": "new_project" | "code_optimization" | "chat",
  "needsCodeFix": true | false,
  "reason": "判断理由"
}

字段说明：
- intent: 
  - "new_project": 用户想创建新项目（如"做一个计算器"、"开发博客系统"）
  - "code_optimization": 用户想修改/修复/优化现有代码（如"改颜色"、"修复bug"、"添加功能"、"修复问题"）
  - "chat": 闲聊或问答（如"你好"、"这个怎么用"）
- needsCodeFix: 是否需要修改现有代码（只有当有现有代码且用户意图是修改时為 true）
- reason: 简短说明判断理由`

  try {
    const response = await getClient().chat.completions.create({
      model: GEMINI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })
    
    const content = response.choices[0]?.message?.content || ''
    
    // 解析 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const result: IntentAnalysis = {
        intent: parsed.intent || 'chat',
        needsCodeFix: Boolean(parsed.needsCodeFix) && hasCode,
        reason: parsed.reason || '',
      }
      
      // 验证 intent 值
      if (!['new_project', 'code_optimization', 'chat'].includes(result.intent)) {
        result.intent = 'chat'
      }
      
      console.log(`[Intent] 分析结果: intent=${result.intent}, needsCodeFix=${result.needsCodeFix}, reason=${result.reason}`)
      return result
    }
    
    throw new Error('Failed to parse intent JSON')
  } catch (error) {
    console.error('Intent detection error:', error)
    // 降级处理：返回默认值
    return {
      intent: hasExistingProject ? 'code_optimization' : 'new_project',
      needsCodeFix: hasCode,
      reason: '意图解析失败，使用默认值',
    }
  }
}

// Mike 的决策节点
async function supervisorNode(state: ProjectState): Promise<ProjectState> {
  // 使用结构化 AI 分析意图
  const intentAnalysis = await detectIntent(state)
  state.intent = intentAnalysis.intent
  
  console.log(`[Supervisor] 意图分析: intent=${intentAnalysis.intent}, needsCodeFix=${intentAnalysis.needsCodeFix}, reason=${intentAnalysis.reason}`)
  
  // 如果是闲聊/QA，直接让Mike回答
  if (intentAnalysis.intent === 'chat') {
    return {
      ...state,
      nextAgent: 'mike',
      currentStatus: 'chatting',
    }
  }
  
  // 如果 AI 判断需要修复代码，直接让Alex处理
  if (intentAnalysis.needsCodeFix && state.code) {
    console.log('[Supervisor] AI 判断需要修复代码，路由到 Alex')
    return {
      ...state,
      nextAgent: 'alex',
      currentStatus: 'coding',
      isModification: true,
    }
  }
  
  // 如果是代码优化但没有现有代码，或是新项目，走完整流程
  const historyContext = state.conversationHistory && state.conversationHistory.length > 0
    ? `\n\n对话历史:\n${state.conversationHistory.slice(-5).map(msg => 
        `${msg.role === 'user' ? '用户' : msg.agent || 'AI'}: ${msg.content}`
      ).join('\n')}`
    : ''
  
  const modificationHint = state.isModification 
    ? '\n\n⚠️ 注意：这是一个修改需求，请判断是否需要重新生成 PRD/架构，还是只需要修改代码。'
    : ''
  
  const prompt = `你是 Atoms 团队的 Team Leader Mike。请分析当前状态并决定下一步行动。
请以 JSON 格式返回结果，包含以下字段：
1. nextAgent: "emma" | "bob" | "alex" | "complete"
2. reason: 决策理由

用户需求: ${state.userMessage}${historyContext}${modificationHint}

当前状态: ${state.currentStatus}
已完成工作: 
- PRD: ${state.prd ? '✅' : '❌'}
- 架构设计: ${state.architecture ? '✅' : '❌'}
- 代码生成: ${state.code ? '✅' : '❌'}

决策逻辑:
1. 如果没有 PRD, 返回 "emma"
2. 如果有 PRD 但没有架构设计, 返回 "bob"
3. 如果有架构设计但没有代码, 返回 "alex"
4. 如果已完成所有工作且用户没有新要求, 返回 "complete"
5. 如果是修改需求, 且 PRD/架构不需要重新生成, 可直接返回 "alex"

只返回 JSON，不要额外解释。`

  try {
    const response = await getClient().chat.completions.create({
      model: GEMINI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })
    
    const content = response.choices[0]?.message?.content || ''
    let nextAgent: ProjectState['nextAgent'] = 'emma'
    
    try {
      const parsed = JSON.parse(content)
      nextAgent = (parsed.nextAgent || parsed.agent || 'emma').toLowerCase() as any
      console.log(`[Supervisor] 决策结果: nextAgent=${nextAgent}, reason=${parsed.reason || '无'}`)
    } catch {
      const match = content.match(/["']?nextAgent["']?\s*:\s*["']?(\w+)["']?/)
      if (match) {
        nextAgent = match[1].toLowerCase() as any
      }
    }
    
    return {
      ...state,
      nextAgent: nextAgent || 'emma',
    }
  } catch (error) {
    console.error('Supervisor error:', error)
    return {
      ...state,
      nextAgent: 'emma',
    }
  }
}

// Mike 的闲聊/QA 节点（流式版本）
async function* mikeChatNodeStream(state: ProjectState): AsyncGenerator<{ type: string, content: string } | ProjectState, ProjectState> {
  const historyContext = state.conversationHistory && state.conversationHistory.length > 0
    ? `\n\n对话历史:\n${state.conversationHistory.slice(-5).map(msg => 
        `${msg.role === 'user' ? '用户' : msg.agent || 'AI'}: ${msg.content}`
      ).join('\n')}`
    : ''
  
  const projectContext = state.code 
    ? `\n\n当前项目状态: 已有代码生成，可以回答关于项目的问题。`
    : state.prd || state.architecture
    ? `\n\n当前项目状态: 项目正在开发中（PRD/架构已生成）。`
    : ''
  
  const prompt = `你是 Atoms 团队的 Team Leader Mike。用户正在与你聊天或提问。

用户消息: ${state.userMessage}${historyContext}${projectContext}

请以友好、专业的语气回答用户的问题。如果是关于项目的问题，可以简要说明当前状态。
如果是闲聊，可以友好地回应并引导用户提出项目需求。

用 Markdown 格式输出。`

  try {
    const stream = await getClient().chat.completions.create({
      model: GEMINI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    })
    
    for await (const chunk of stream) {
      const chunkContent = chunk.choices[0]?.delta?.content || ''
      if (chunkContent) {
        yield {
          type: 'content_chunk',
          content: chunkContent,
        }
      }
    }
    
    return {
      ...state,
      currentStatus: 'complete',
    }
  } catch (error) {
    console.error('Mike chat error:', error)
    return {
      ...state,
      currentStatus: 'complete',
    }
  }
}

// Emma 的 PRD 生成节点（流式版本）
async function* emmaPRDNodeStream(state: ProjectState): AsyncGenerator<{ type: string, content: string } | ProjectState, ProjectState> {
  const historyContext = state.conversationHistory && state.conversationHistory.length > 0
    ? `\n\n对话历史:\n${state.conversationHistory.slice(-3).map(msg => 
        `${msg.role === 'user' ? '用户' : msg.agent || 'AI'}: ${msg.content}`
      ).join('\n')}`
    : ''
  
  const modificationContext = state.isModification && state.prd
    ? `\n\n⚠️ 注意：这是对现有项目的修改。之前的 PRD:\n${state.prd}\n\n请根据新的需求更新 PRD，保留仍然适用的部分。`
    : ''
  
  const prompt = `作为产品经理 Emma,为以下需求生成精简的 PRD:

用户需求: ${state.userMessage}${historyContext}${modificationContext}

请用简洁的 bullet points 格式输出，每个要点一行，不要冗长描述:

1. 产品概述 (1-2 句话)
2. 核心功能 (3-5 个要点)
3. 技术栈建议 (列出技术即可)
4. 验收标准 (3-5 个要点)

输出格式示例:
- 产品概述: xxx
- 核心功能:
  - 功能1
  - 功能2
- 技术栈: React, CSS
- 验收标准:
  - 标准1
  - 标准2

保持简洁，每个要点不超过一行。`

  try {
    const stream = await getClient().chat.completions.create({
      model: GEMINI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    })
    
    let fullContent = ''
    for await (const chunk of stream) {
      const chunkContent = chunk.choices[0]?.delta?.content || ''
      if (chunkContent) {
        fullContent += chunkContent
        yield {
          type: 'content_chunk',
          content: chunkContent,
        }
      }
    }
    
    return {
      ...state,
      prd: fullContent,
      currentStatus: 'designing',
    }
  } catch (error) {
    console.error('Emma PRD error:', error)
    return {
      ...state,
      prd: `PRD 生成失败: ${error instanceof Error ? error.message : String(error)}`,
      currentStatus: 'designing',
    }
  }
}

// Emma 的 PRD 生成节点（兼容版本）
async function emmaPRDNode(state: ProjectState): Promise<ProjectState> {
  const prompt = `作为产品经理 Emma,为以下需求生成精简的 PRD:

用户需求: ${state.userMessage}

请用简洁的 bullet points 格式输出，每个要点一行，不要冗长描述:

1. 产品概述 (1-2 句话)
2. 核心功能 (3-5 个要点)
3. 技术栈建议 (列出技术即可)
4. 验收标准 (3-5 个要点)

输出格式示例:
- 产品概述: xxx
- 核心功能:
  - 功能1
  - 功能2
- 技术栈: React, CSS
- 验收标准:
  - 标准1
  - 标准2

保持简洁，每个要点不超过一行。`

  try {
    const response = await getClient().chat.completions.create({
      model: GEMINI_MODEL,
      messages: [{ role: 'user', content: prompt }],
    })
    
    const content = response.choices[0]?.message?.content || ''
    return {
      ...state,
      prd: content,
      currentStatus: 'designing',
    }
  } catch (error) {
    console.error('Emma PRD error:', error)
    return {
      ...state,
      prd: `PRD 生成失败: ${error instanceof Error ? error.message : String(error)}`,
      currentStatus: 'designing',
    }
  }
}

// Bob 的架构设计节点（流式版本）
async function* bobArchitectureNodeStream(state: ProjectState): AsyncGenerator<{ type: string, content: string } | ProjectState, ProjectState> {
  const historyContext = state.conversationHistory && state.conversationHistory.length > 0
    ? `\n\n对话历史:\n${state.conversationHistory.slice(-3).map(msg => 
        `${msg.role === 'user' ? '用户' : msg.agent || 'AI'}: ${msg.content}`
      ).join('\n')}`
    : ''
  
  const modificationContext = state.isModification && state.architecture
    ? `\n\n⚠️ 注意：这是对现有项目的修改。之前的架构:\n${state.architecture}\n\n请根据新的需求更新架构，保留仍然适用的部分。`
    : ''
  
  const prompt = `作为架构师 Bob,为以下项目 design 精简的技术架构:

用户需求: ${state.userMessage}
PRD: ${state.prd || '暂无'}${historyContext}${modificationContext}

请用简洁的 bullet points 格式输出，每个要点一行:

1. 技术栈 (列出技术即可，如: React, CSS)
2. 关键组件 (3-5 个组件名称)
3. 数据模型 (如有，列出主要数据结构)

输出格式示例:
- 技术栈: React, CSS
- 关键组件:
  - Component1
  - Component2
- 数据模型:
  - Model1: {field1, field2}

保持简洁，不要冗长描述，每个要点不超过一行。`

  try {
    const stream = await getClient().chat.completions.create({
      model: GEMINI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    })
    
    let fullContent = ''
    for await (const chunk of stream) {
      const chunkContent = chunk.choices[0]?.delta?.content || ''
      if (chunkContent) {
        fullContent += chunkContent
        yield {
          type: 'content_chunk',
          content: chunkContent,
        }
      }
    }
    
    return {
      ...state,
      architecture: fullContent,
      currentStatus: 'coding',
    }
  } catch (error) {
    console.error('Bob architecture error:', error)
    return {
      ...state,
      architecture: `架构设计生成失败: ${error instanceof Error ? error.message : String(error)}`,
      currentStatus: 'coding',
    }
  }
}

// Bob 的架构设计节点（兼容版本）
async function bobArchitectureNode(state: ProjectState): Promise<ProjectState> {
  const prompt = `作为架构师 Bob,为以下项目设计精简的技术架构:

用户需求: ${state.userMessage}
PRD: ${state.prd || '暂无'}

请用简洁的 bullet points 格式输出，每个要点一行:

1. 技术栈 (列出技术即可，如: React, CSS)
2. 关键组件 (3-5 个组件名称)
3. 数据模型 (如有，列出主要数据结构)

输出格式示例:
- 技术栈: React, CSS
- 关键组件:
  - Component1
  - Component2
- 数据模型:
  - Model1: {field1, field2}

保持简洁，不要冗长描述，每个要点不超过一行。`

  try {
    const response = await getClient().chat.completions.create({
      model: GEMINI_MODEL,
      messages: [{ role: 'user', content: prompt }],
    })
    
    const content = response.choices[0]?.message?.content || ''
    return {
      ...state,
      architecture: content,
      currentStatus: 'coding',
    }
  } catch (error) {
    console.error('Bob architecture error:', error)
    return {
      ...state,
      architecture: `架构设计生成失败: ${error instanceof Error ? error.message : String(error)}`,
      currentStatus: 'coding',
    }
  }
}

// Alex 的代码生成节点（流式版本）
async function* alexCodeGenNodeStream(state: ProjectState): AsyncGenerator<{ type: string, content: string } | ProjectState, ProjectState> {
  const historyContext = state.conversationHistory && state.conversationHistory.length > 0
    ? `\n\n对话历史:\n${state.conversationHistory.slice(-3).map(msg => 
        `${msg.role === 'user' ? '用户' : msg.agent || 'AI'}: ${msg.content}`
      ).join('\n')}`
    : ''
  
  const modificationContext = state.isModification && state.code
    ? `\n\n⚠️ 注意：这是对现有项目的修改。之前的完整代码文件:\n${Object.entries(state.code).map(([file, content]) => 
        `\n${file}:\n${content}`
      ).join('\n---\n')}\n\n请根据新的需求修改代码，保留仍然适用的部分。必须返回完整的、可运行的代码文件。`
    : ''
  
  const isModification = !!(state.isModification && state.code)
  const prompt = isModification
    ? `作为工程师 Alex,根据以下需求修改现有代码。
请以 JSON 格式返回结果，包含以下字段：
1. explanation: 简洁的修改说明（1-2句话）
2. diff: 只包含修改部分的 diff 格式代码
3. files: 包含修改后的所有完整文件内容的对象（Record<string, string>）

原始需求: ${state.originalUserMessage || state.userMessage.split('\n\n⚠️')[0].split('\n\n🔍')[0]}
${state.userMessage.includes('⚠️ 修复要求') ? `修复要求: ${state.userMessage.split('⚠️ 修复要求：')[1]?.split('\n\n请确保')[0] || ''}` : ''}
PRD: ${state.prd || '暂无'}
架构: ${state.architecture || '暂无'}${historyContext}${modificationContext}

⚠️ 重要：生成的代码必须是完整的、可运行的 React 组件。只返回 JSON，不要包含其他解释文本。`
    : `作为工程师 Alex,为以下项目生成代码。
请以 JSON 格式返回结果，包含以下字段：
1. explanation: 简洁的实现说明
2. files: 包含所有代码文件的对象（Record<string, string>），必须包含 App.tsx, index.css, package.json

用户需求: ${state.originalUserMessage || state.userMessage.split('\n\n⚠️')[0].split('\n\n🔍')[0]}
PRD: ${state.prd || '暂无'}
架构: ${state.architecture || '暂无'}${historyContext}
${state.userMessage.includes('⚠️ 修复要求') ? `\n\n修复要求: ${state.userMessage.split('⚠️ 修复要求：')[1]?.split('\n\n请确保')[0] || ''}` : ''}

⚠️ 重要：请生成完整的、可运行的 React 代码。只返回 JSON，不要包含其他解释文本。`

  try {
    const stream = await getClient().chat.completions.create({
      model: GEMINI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      response_format: { type: 'json_object' },
    })
    
    let fullContent = ''
    for await (const chunk of stream) {
      const chunkContent = chunk.choices[0]?.delta?.content || ''
      if (chunkContent) {
        fullContent += chunkContent
        yield {
          type: 'content_chunk',
          content: chunkContent,
        }
      }
    }
    
    // 解析代码
    let code: Record<string, string> = {}
    try {
      let jsonContent = fullContent
      jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*/g, '')
      jsonContent = jsonContent.replace(/🔍\s*验证发现问题[^\n]*\n/g, '')
      jsonContent = jsonContent.replace(/⚠️\s*验证发现问题[^\n]*\n/g, '')
      jsonContent = jsonContent.replace(/请修复这些问题[^\n]*\n/g, '')
      
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const actualCode = parsed.files || parsed // 优先使用 files 字段
        const codeKeys = Object.keys(actualCode)
        const hasValidCode = codeKeys.some(key => {
          const content = actualCode[key]
          return typeof content === 'string' && 
                 content.length > 20 && // 降低长度要求，因为有些文件可能很短
                 !content.includes('🔍 验证发现问题') &&
                 !content.includes('⚠️ 验证发现问题') &&
                 !content.includes('页面完全空白')
        })
        
        if (hasValidCode) {
          code = actualCode
        } else {
          throw new Error('Parsed code contains error messages, not valid code')
        }
      } else {
        throw new Error('No JSON code block found')
      }
    } catch (error) {
      console.warn('Failed to parse code from LLM response, using fallback:', error)
      if (state.code && Object.keys(state.code).length > 0) {
        code = state.code
      } else {
        const originalReq = state.originalUserMessage || state.userMessage.split('\n\n⚠️')[0].split('\n\n🔍')[0]
        code = {
          'App.tsx': `import React from 'react';\n\nexport default function App() {\n  return (\n    <div>\n      <h1>${originalReq}</h1>\n    </div>\n  );\n}`,
          'index.css': 'body { margin: 0; padding: 20px; font-family: sans-serif; }',
          'package.json': JSON.stringify({ name: 'app', version: '1.0.0', dependencies: { react: '^18.0.0' } }, null, 2),
        }
      }
    }
    
    return {
      ...state,
      code,
      currentStatus: 'complete',
    }
  } catch (error) {
    console.error('Alex code gen error:', error)
    return {
      ...state,
      code: {
        'App.tsx': `import React from 'react';\n\nexport default function App() {\n  return <div><h1>${state.userMessage}</h1></div>;\n}`,
      },
      currentStatus: 'complete',
    }
  }
}

// Alex 的代码生成节点（兼容版本）
async function alexCodeGenNode(state: ProjectState): Promise<ProjectState> {
  const isModification = state.isModification && state.code
  const modificationContext = state.isModification && state.code
    ? `\n\n⚠️ 注意：这是对现有项目的修改。之前的完整代码文件:\n${Object.entries(state.code).map(([file, content]) => 
        `\n${file}:\n${content}`
      ).join('\n---\n')}\n\n请根据新的需求修改代码，保留仍然适用的部分。必须返回完整的、可运行的代码文件。`
    : ''
  
  const prompt = isModification
    ? `作为工程师 Alex,根据以下需求修改现有代码。
请以 JSON 格式返回结果，包含以下字段：
1. explanation: 简洁的修改说明（1-2句话）
2. diff: 只包含修改部分的 diff 格式代码
3. files: 包含修改后的所有完整文件内容的对象（Record<string, string>）

用户需求: ${state.userMessage}
PRD: ${state.prd || '暂无'}
架构: ${state.architecture || '暂无'}${modificationContext}

⚠️ 重要：生成的代码必须是完整的、可运行的 React 组件。只返回 JSON，不要包含其他解释文本。`
    : `作为工程师 Alex,为以下项目生成代码。
请以 JSON 格式返回结果，包含以下字段：
1. explanation: 简洁的实现说明
2. files: 包含所有代码文件的对象（Record<string, string>），必须包含 App.tsx, index.css, package.json

用户需求: ${state.userMessage}
PRD: ${state.prd || '暂无'}
架构: ${state.architecture || '暂无'}

请生成一个简单的 React 应用。只返回 JSON，不要包含其他解释文本。`

  try {
    const response = await getClient().chat.completions.create({
      model: GEMINI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })
    
    const content = response.choices[0]?.message?.content || ''
    let code: Record<string, string> = {}
    
    try {
      const parsed = JSON.parse(content)
      code = parsed.files || parsed // 兼容旧格式或直接返回 files
    } catch {
      // 如果解析失败，尝试正则表达式提取
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        code = parsed.files || parsed
      } else {
        code = {
          'App.tsx': `import React from 'react';\n\nexport default function App() {\n  return (\n    <div>\n      <h1>${state.userMessage}</h1>\n    </div>\n  );\n}`,
          'index.css': 'body { margin: 0; padding: 20px; font-family: sans-serif; }',
          'package.json': JSON.stringify({ name: 'app', version: '1.0.0', dependencies: { react: '^18.0.0' } }, null, 2),
        }
      }
    }
    
    return {
      ...state,
      code,
      currentStatus: 'complete',
    }
  } catch (error) {
    console.error('Alex code gen error:', error)
    return {
      ...state,
      code: {
        'App.tsx': `import React from 'react';\n\nexport default function App() {\n  return <div><h1>${state.userMessage}</h1></div>;\n}`,
      },
      currentStatus: 'complete',
    }
  }
}

// 从数据库加载项目状态
async function loadProjectState(projectId: string): Promise<Partial<ProjectState> | null> {
  if (!supabase) {
    console.warn('Supabase not configured, skipping state load')
    return null
  }
  
  try {
    const { data, error } = await supabase
      .from('project_states')
      .select('state')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        console.warn('project_states table does not exist yet, please run database migration')
        return null
      }
      console.error('Load project state error:', error)
      return null
    }
    
    if (!data || !data.state) return null
    
    if (typeof data.state === 'string') {
      return JSON.parse(data.state)
    }
    return data.state as Partial<ProjectState>
  } catch (error) {
    console.error('Load project state error:', error)
    return null
  }
}

// 保存项目状态到数据库
async function saveProjectState(projectId: string, userId: string, state: ProjectState): Promise<void> {
  if (!supabase) {
    console.warn('Supabase not configured, skipping state save')
    return
  }
  
  try {
    const stateToSave = {
      prd: state.prd,
      architecture: state.architecture,
      code: state.code,
      currentStatus: state.currentStatus,
    }
    
    const { error } = await supabase
      .from('project_states')
      .upsert({
        project_id: projectId,
        user_id: userId,
        state: stateToSave,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,user_id'
      })
    
    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        console.warn('project_states table does not exist yet, please run database migration')
        return
      }
      console.error('Save project state error:', error)
    }
  } catch (error) {
    console.error('Save project state error:', error)
  }
}

// 快速判断是否可能是修改需求
function quickCheckModification(userMessage: string, previousState: Partial<ProjectState> | null): boolean {
  if (!previousState || (!previousState.prd && !previousState.code)) {
    return false
  }
  
  const modificationKeywords = ['修复', '修改', '改成', '改为', '调整', '更新', '改', '换', '修', 'fix', 'repair', 'change', 'modify', 'update', 'adjust', '添加', '删除', '优化']
  const lowerMessage = userMessage.toLowerCase()
  
  return modificationKeywords.some(keyword => lowerMessage.includes(keyword))
}

// 流式工作流实现
async function* invokeStream({ userMessage, projectId, userId, conversationHistory }: {
  userMessage: string
  projectId: string
  userId: string
  conversationHistory?: Array<{ role: 'user' | 'assistant', content: string, agent?: string }>
}) {
  const previousState = await loadProjectState(projectId)
  const quickCheck = quickCheckModification(userMessage, previousState)
  
  let initialStatus: ProjectState['currentStatus'] = previousState?.currentStatus || 'planning'
  if (quickCheck && previousState?.code && Object.keys(previousState.code).length > 0) {
    initialStatus = 'coding'
    console.log('初步检测到修复/修改请求，设置状态为 coding')
  }
  
  let state: ProjectState = {
    userMessage,
    currentStatus: initialStatus,
    prd: previousState?.prd,
    architecture: previousState?.architecture,
    code: previousState?.code,
    conversationHistory: conversationHistory || [],
    isModification: quickCheck,
    originalUserMessage: userMessage,
  }

  const maxIterations = 10
  let iterations = 0

  yield {
    type: 'agent_start',
    agent: 'mike',
    content: `收到！让我召集团队开始工作...`,
  }

  while (iterations < maxIterations && state.currentStatus !== 'complete') {
    iterations++
    
    console.log(`[Iteration ${iterations}] Current state:`, {
      status: state.currentStatus,
      hasPRD: !!state.prd,
      hasArch: !!state.architecture,
      hasCode: !!state.code,
    })

    state = await supervisorNode(state)
    
    console.log(`[Iteration ${iterations}] Supervisor decided:`, state.nextAgent)

    if (state.nextAgent === 'complete') {
      console.log('Project completed!')
      break
    }
    
    if (!state.nextAgent) {
      console.warn('No next agent decided, breaking loop')
      break
    }

    if (state.nextAgent === 'mike') {
      yield {
        type: 'agent_start',
        agent: 'mike',
        content: `💬 **Mike (Team Leader)** 正在回答...`,
      }
      
      let accumulatedContent = `💬 **Mike (Team Leader)** 正在回答...\n\n`
      const chatStream = mikeChatNodeStream(state)
      
      for await (const chunk of chatStream) {
        if ('type' in chunk && chunk.type === 'content_chunk') {
          accumulatedContent += chunk.content
          yield {
            type: 'content_update',
            agent: 'mike',
            content: accumulatedContent,
          }
        }
      }
      
      yield {
        type: 'agent_complete',
        agent: 'mike',
        content: accumulatedContent,
      }
      
      yield {
        type: 'complete',
        agent: 'mike',
        content: accumulatedContent,
      }
      
      state.currentStatus = 'complete'
      break
    }

    if (state.nextAgent === 'emma' && !state.prd) {
      yield {
        type: 'agent_start',
        agent: 'emma',
        content: `📋 **Emma (产品经理)** 正在分析需求...`,
      }
      
      let accumulatedContent = `📋 **Emma (产品经理)** 正在分析需求...\n\n`
      const prdStream = emmaPRDNodeStream(state)
      
      let fullContent = ''
      for await (const chunk of prdStream) {
        if ('type' in chunk && chunk.type === 'content_chunk') {
          fullContent += chunk.content
          accumulatedContent += chunk.content
          yield {
            type: 'content_update',
            agent: 'emma',
            content: accumulatedContent,
          }
        }
      }
      
      if (fullContent) {
        state = {
          ...state,
          prd: fullContent,
          currentStatus: 'designing',
        }
        console.log('Emma PRD generated, length:', fullContent.length)
      }
      
      yield {
        type: 'agent_complete',
        agent: 'emma',
        content: `📋 **Emma (产品经理)** 已完成需求分析\n\n${state.prd || ''}`,
        artifacts: state.prd ? [{ id: 'prd-1', type: 'prd', content: state.prd, title: '产品需求文档' }] : [],
      }
      continue
    }

    if (state.nextAgent === 'bob' && !state.architecture) {
      yield {
        type: 'agent_start',
        agent: 'bob',
        content: `🏗️ **Bob (架构师)** 正在设计架构...`,
      }
      
      let accumulatedContent = `🏗️ **Bob (架构师)** 正在设计架构...\n\n`
      const archStream = bobArchitectureNodeStream(state)
      
      let fullContent = ''
      for await (const chunk of archStream) {
        if ('type' in chunk && chunk.type === 'content_chunk') {
          fullContent += chunk.content
          accumulatedContent += chunk.content
          yield {
            type: 'content_update',
            agent: 'bob',
            content: accumulatedContent,
          }
        }
      }
      
      if (fullContent) {
        state = {
          ...state,
          architecture: fullContent,
          currentStatus: 'coding',
        }
        console.log('Bob architecture generated, length:', fullContent.length)
      }
      
      yield {
        type: 'agent_complete',
        agent: 'bob',
        content: `🏗️ **Bob (架构师)** 已完成架构设计\n\n${state.architecture || ''}`,
        artifacts: state.architecture ? [{ id: 'arch-1', type: 'architecture', content: state.architecture, title: '技术架构' }] : [],
      }
      continue
    }

    if (state.nextAgent === 'alex' && (!state.code || state.currentStatus === 'coding')) {
      const isFixing = state.code && state.currentStatus === 'coding'
      yield {
        type: 'agent_start',
        agent: 'alex',
        content: isFixing 
          ? `🔧 **Alex (工程师)** 正在修复代码...`
          : `💻 **Alex (工程师)** 正在生成代码...`,
      }
      
      let accumulatedContent = isFixing
        ? `🔧 **Alex (工程师)** 正在修复代码...\n\n`
        : `💻 **Alex (工程师)** 正在生成代码...\n\n`
      const codeStream = alexCodeGenNodeStream(state)
      
      let fullContent = ''
      let detectedFiles: string[] = []
      
      for await (const chunk of codeStream) {
        if ('type' in chunk && chunk.type === 'content_chunk') {
          fullContent += chunk.content
          
          try {
            const jsonMatch = fullContent.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[0])
                const newFiles = Object.keys(parsed).filter(f => !detectedFiles.includes(f))
                if (newFiles.length > 0) {
                  detectedFiles.push(...newFiles)
                  accumulatedContent = isFixing
                    ? `🔧 **Alex (工程师)** 正在修复代码...\n\n正在处理文件:\n${detectedFiles.map(f => `  - ${f}`).join('\n')}\n`
                    : `💻 **Alex (工程师)** 正在生成代码...\n\n正在生成文件:\n${detectedFiles.map(f => `  - ${f}`).join('\n')}\n`
                }
              } catch (e) {}
            } else {
              const filePattern = /["']([^"']+\.(tsx?|jsx?|css|json|html))["']\s*:/g
              const matches = [...fullContent.matchAll(filePattern)]
              const newFiles = matches
                .map(m => m[1])
                .filter(f => !detectedFiles.includes(f))
              if (newFiles.length > 0) {
                detectedFiles.push(...newFiles)
                accumulatedContent = isFixing
                  ? `🔧 **Alex (工程师)** 正在修复代码...\n\n正在处理文件:\n${detectedFiles.map(f => `  - ${f}`).join('\n')}\n`
                  : `💻 **Alex (工程师)** 正在生成代码...\n\n正在生成文件:\n${detectedFiles.map(f => `  - ${f}`).join('\n')}\n`
              }
            }
          } catch (e) {
            if (accumulatedContent.length < 500) {
              accumulatedContent += chunk.content
            }
          }
          
          yield {
            type: 'content_update',
            agent: 'alex',
            content: accumulatedContent,
          }
        }
      }
      
      if (fullContent) {
        try {
          const jsonMatch = fullContent.match(/\{[\s\S]*\}/)
          let code: Record<string, string> = {}
          
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            code = parsed.files || parsed
          } else {
            code = {
              'App.tsx': `import React from 'react';\n\nexport default function App() {\n  return (\n    <div>\n      <h1>${state.userMessage}</h1>\n    </div>\n  );\n}`,
              'index.css': 'body { margin: 0; padding: 20px; font-family: sans-serif; }',
              'package.json': JSON.stringify({ name: 'app', version: '1.0.0', dependencies: { react: '^18.0.0' } }, null, 2),
            }
          }
          
          state = {
            ...state,
            code,
            currentStatus: 'complete',
          }
          console.log('Alex code generated, files:', Object.keys(code))
        } catch (error) {
          console.error('Failed to parse code from stream:', error)
          state = {
            ...state,
            code: {
              'App.tsx': `import React from 'react';\n\nexport default function App() {\n  return <div><h1>${state.userMessage}</h1></div>;\n}`,
            },
            currentStatus: 'complete',
          }
        }
      }
      
      let sandboxInfo: any = null
      if (state.code) {
        try {
          const { sandboxService } = await import('../services/sandbox')
          const needsSandbox = sandboxService.needsSandbox(state.code)
          
          if (needsSandbox && process.env.DAYTONA_API_KEY) {
            yield {
              type: 'agent_start',
              agent: 'alex',
              content: `🚀 **Alex (工程师)** 正在创建沙盒环境并部署应用...`,
            }
            
            try {
              const sandboxResult = await sandboxService.createSandbox({
                userId: userId,
                projectId: projectId,
                code: state.code,
              })
              
              if (sandboxResult.type === 'daytona' && sandboxResult.containerId) {
                // 写入所有生成的文件
                for (const [filePath, content] of Object.entries(state.code)) {
                  await sandboxService.writeFile(sandboxResult.containerId, filePath, content)
                }
                
                // 如果没有 index.html 但有 React 组件，生成一个 index.html
                if (!state.code['index.html']) {
                  const mainFile = state.code['App.tsx'] || state.code['App.jsx'] || state.code['app.tsx'] || state.code['app.jsx']
                  if (mainFile) {
                    const cssContent = state.code['index.css'] || state.code['App.css'] || state.code['styles.css'] || ''
                    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    ${cssContent}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useCallback, useEffect, useRef, useMemo } = React;
    ${mainFile
      .replace(/export default/g, 'const App =')
      .replace(/export /g, '')
      .replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '')
      .replace(/import\s+['"].*?['"];?\s*/g, '')
      .replace(/interface\s+\w+\s*\{[^}]*\}\s*/g, '')
      .replace(/type\s+\w+\s*=\s*.*?;\s*/g, '')
      .replace(/:\s*React\.\w+(<[^>]*>)?/g, '')
      .replace(/useState\s*<[^>]+>/g, 'useState')
      .replace(/useCallback\s*<[^>]+>/g, 'useCallback')
      .replace(/useEffect\s*<[^>]+>/g, 'useEffect')
      .replace(/:\s*(number|string|boolean|void|any)(\s*\|\s*(number|string|boolean|null))?/g, '')
      .replace(/<(number|string|boolean)(\s*\|\s*null)?>/g, '')
    }
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>`
                    await sandboxService.writeFile(sandboxResult.containerId, 'index.html', indexHtml)
                    console.log('Generated index.html for React app')
                  }
                }
                
                if (state.code['package.json']) {
                  try {
                    await sandboxService.runCommand(
                      sandboxResult.containerId,
                      'cd /workspace && npm install',
                      true,
                      300
                    )
                  } catch (error) {
                    console.error('Failed to install dependencies:', error)
                  }
                }
                
                // 先杀掉可能占用 8080 端口的默认服务
                try {
                  await sandboxService.runCommand(
                    sandboxResult.containerId,
                    'pkill -f "port.*8080" || fuser -k 8080/tcp || kill $(lsof -t -i:8080) || true',
                    true,
                    10
                  )
                  console.log('Killed existing process on port 8080')
                  // 等待端口释放
                  await new Promise(resolve => setTimeout(resolve, 1000))
                } catch (error) {
                  // 忽略错误，可能没有进程在运行
                  console.log('No existing process on port 8080 or failed to kill')
                }
                
                // 启动 Web 服务器
                let serverStarted = false
                
                if (state.code['package.json']) {
                  try {
                    const pkg = JSON.parse(state.code['package.json'])
                    if (pkg.scripts && (pkg.scripts.start || pkg.scripts.dev)) {
                      const startCmd = pkg.scripts.dev ? 'npm run dev' : 'npm start'
                      // 设置 PORT 和 HOST 确保服务器绑定到正确的地址
                      await sandboxService.runCommand(
                        sandboxResult.containerId,
                        `cd /workspace && PORT=8080 HOST=0.0.0.0 ${startCmd}`,
                        false
                      )
                      serverStarted = true
                    }
                  } catch (error) {
                    console.error('Failed to start npm server:', error)
                  }
                }
                
                // 如果没有通过 npm 启动服务器，使用 Python 简单 HTTP 服务器
                if (!serverStarted) {
                  try {
                    // 必须绑定到 0.0.0.0 才能从外部访问
                    await sandboxService.runCommand(
                      sandboxResult.containerId,
                      'cd /workspace && python3 -m http.server 8080 --bind 0.0.0.0',
                      false
                    )
                    console.log('Started Python HTTP server on port 8080 (0.0.0.0)')
                  } catch (error) {
                    console.error('Failed to start Python HTTP server:', error)
                    // 尝试使用 npx serve 作为备选（默认绑定 0.0.0.0）
                    try {
                      await sandboxService.runCommand(
                        sandboxResult.containerId,
                        'cd /workspace && npx -y serve -l 8080 --no-clipboard',
                        false
                      )
                      console.log('Started npx serve on port 8080')
                    } catch (serveError) {
                      console.error('Failed to start any HTTP server:', serveError)
                    }
                  }
                }
                
                // 等待服务器启动
                await new Promise(resolve => setTimeout(resolve, 3000))
                console.log('Web server should be ready now')
                
                sandboxInfo = {
                  sandboxId: sandboxResult.containerId,
                  vncUrl: sandboxResult.vncUrl,
                  websiteUrl: sandboxResult.websiteUrl,
                }
              }
            } catch (error) {
              console.error('Failed to create sandbox:', error)
            }
          }
        } catch (error) {
          console.error('Sandbox service error:', error)
        }
      }
      
      // 如果没有沙盒环境，生成静态预览 HTML
      if (!sandboxInfo && state.code) {
        try {
          const { generatePreviewHTMLFromCode } = await import('../services/verify')
          const html = generatePreviewHTMLFromCode(state.code)
          sandboxInfo = {
            sandboxId: 'static-preview',
            websiteUrl: null,
            vncUrl: null,
            previewHtml: html,
            type: 'static'
          }
        } catch (error) {
          console.error('Failed to generate static preview:', error)
        }
      }
      
      let sandboxNote = ''
      if (sandboxInfo) {
        if (sandboxInfo.type === 'daytona') {
          sandboxNote = `\n\n🌐 **应用已部署到沙盒环境**\n- 访问地址: ${sandboxInfo.websiteUrl}\n- VNC 远程桌面: ${sandboxInfo.vncUrl}`
        } else if (sandboxInfo.type === 'static') {
          sandboxNote = `\n\n📄 **已生成静态预览**\n- 可以在右侧查看预览效果`
        }
      }
      
      const codeArtifact = {
        id: 'code-1',
        type: 'code' as const,
        content: state.code,
        title: '生成的代码',
        sandboxInfo: sandboxInfo,
      }
      
      yield {
        type: 'agent_complete',
        agent: 'alex',
        content: `💻 **Alex (工程师)** 已完成代码生成！${sandboxNote}`,
        artifacts: state.code ? [codeArtifact] : [],
      }
      
      if (state.code) {
        yield {
          type: 'agent_start',
          agent: 'mike',
          content: `🔍 **Mike (Team Leader)** 正在验证预览页面...`,
        }
        
        try {
          const { verifyPreview, generateVerificationFeedback } = await import('../services/verify')
          const previewUrl = sandboxInfo?.websiteUrl
          
          const verifyResult = await verifyPreview({
            previewUrl,
            userRequirement: state.userMessage,
            prd: state.prd,
            architecture: state.architecture,
            code: state.code,
          })
          
          const feedback = generateVerificationFeedback(verifyResult)
          
          if (!verifyResult.passed && verifyResult.needsImprovement) {
            yield {
              type: 'agent_start',
              agent: 'mike',
              content: feedback,
            }
            
            state.currentStatus = 'coding'
            state.nextAgent = 'alex'
            if (!state.originalUserMessage) {
              state.originalUserMessage = state.userMessage.split('\n\n⚠️')[0].split('\n\n🔍')[0]
            }
            
            const issuesText = verifyResult.issues.length > 0 
              ? verifyResult.issues.join('\n')
              : '预览页面存在问题，需要修复'
            
            const originalReq = state.originalUserMessage
            state.userMessage = `${originalReq}\n\n⚠️ 修复要求：预览页面验证发现问题，请修复以下问题：\n${issuesText}\n\n请确保生成的代码是完整的、可运行的 React 组件，不要包含错误信息文本。`
            state.isModification = true
            continue
          } else {
            yield {
              type: 'agent_complete',
              agent: 'mike',
              content: feedback,
            }
          }
        } catch (error) {
          console.error('Verification error:', error)
          yield {
            type: 'agent_complete',
            agent: 'mike',
            content: `⚠️ 验证过程遇到问题: ${error instanceof Error ? error.message : String(error)}。代码已生成，请手动检查预览页面。`,
          }
        }
      }
      
      if (state.code) {
        if (state.currentStatus !== 'coding') {
          state.currentStatus = 'complete'
          yield {
            type: 'complete',
            agent: 'mike',
            content: `🎉 太棒了！项目已经完成。\n\n✅ PRD 已生成\n✅ 架构设计已完成\n✅ 代码已生成${sandboxInfo ? '\n✅ 应用已部署到沙盒环境' : ''}\n\n${sandboxInfo ? `你可以访问: ${sandboxInfo.websiteUrl}` : '你可以查看右侧的代码预览。'}`,
            artifacts: [
              ...(state.prd ? [{ id: 'prd-1', type: 'prd', content: state.prd, title: '产品需求文档' }] : []),
              ...(state.architecture ? [{ id: 'arch-1', type: 'architecture', content: state.architecture, title: '技术架构' }] : []),
              ...(state.code ? [codeArtifact] : []),
            ],
          }
          break
        }
      }
      continue
    }

    if (state.prd && state.architecture && state.code) {
      yield {
        type: 'complete',
        agent: 'mike',
        content: `🎉 太棒了！项目已经完成。\n\n✅ PRD 已生成\n✅ 架构设计已完成\n✅ 代码已生成\n\n你可以查看右侧的代码预览。`,
        artifacts: [
          { id: 'prd-1', type: 'prd', content: state.prd, title: '产品需求文档' },
          { id: 'arch-1', type: 'architecture', content: state.architecture, title: '技术架构' },
          { id: 'code-1', type: 'code', content: state.code, title: '生成的代码' },
        ],
      }
      break
    }
    
    await saveProjectState(projectId, userId, state)
  }
  
  await saveProjectState(projectId, userId, state)
}

// 简化的工作流实现
export function createMikeAgent() {
  return {
    async invoke({ userMessage, projectId, userId }: {
      userMessage: string
      projectId: string
      userId: string
    }): Promise<AgentResponse> {
      const results: any[] = []
      for await (const chunk of invokeStream({ userMessage, projectId, userId })) {
        results.push(chunk)
      }
      
      const lastComplete = results.filter(r => r.type === 'complete' || r.type === 'agent_complete').pop()
      if (lastComplete) {
        return {
          id: Date.now().toString(),
          agent: lastComplete.agent,
          content: lastComplete.content,
          artifacts: lastComplete.artifacts || [],
        }
      }
      
      return {
        id: Date.now().toString(),
        agent: 'mike',
        content: '处理完成',
        artifacts: [],
      }
    },
    
    invokeStream,
  }
}
