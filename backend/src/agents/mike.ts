import { ChatAnthropic } from '@langchain/anthropic'
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

// 延迟初始化 model，避免在测试时因为没有 API key 而失败
let model: ChatAnthropic | null = null

function getModel() {
  if (!model) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required. For testing, use mock implementations.')
    }
    model = new ChatAnthropic({
      modelName: 'claude-sonnet-4-20250514',
      anthropicApiKey: apiKey,
      temperature: 0.7,
    })
  }
  return model
}

// 意图理解：判断用户意图
async function detectIntent(state: ProjectState): Promise<'new_project' | 'code_optimization' | 'chat'> {
  const hasExistingProject = !!(state.prd || state.architecture || state.code)
  
  const prompt = `分析用户消息的意图，判断属于以下哪种类型：

1. "new_project" - 新项目需求（如"做一个计算器"、"开发一个博客系统"）
2. "code_optimization" - 代码优化/修改需求（如"改个颜色"、"修复bug"、"优化性能"、"添加功能"）
3. "chat" - 闲聊或QA（如"你好"、"谢谢"、"这个怎么用"、"解释一下"）

用户消息: ${state.userMessage}
${hasExistingProject ? '已有项目: ✅ (PRD/架构/代码已存在)' : '已有项目: ❌ (新项目)'}

只返回类型名称（new_project、code_optimization 或 chat），不要额外解释。`

  try {
    const response = await getModel().invoke(prompt)
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content)
    const intent = content.trim().toLowerCase() as any
    
    if (intent === 'code_optimization' || intent === 'chat' || intent === 'new_project') {
      return intent
    }
    
    // 默认判断：如果有现有项目且消息包含修改关键词，则是优化
    if (hasExistingProject && (
      state.userMessage.includes('改') || 
      state.userMessage.includes('修') || 
      state.userMessage.includes('优化') ||
      state.userMessage.includes('添加') ||
      state.userMessage.includes('调整')
    )) {
      return 'code_optimization'
    }
    
    // 如果是新项目关键词
    if (state.userMessage.includes('做') || 
        state.userMessage.includes('开发') || 
        state.userMessage.includes('创建') ||
        state.userMessage.includes('生成')) {
      return 'new_project'
    }
    
    // 默认是聊天
    return 'chat'
  } catch (error) {
    console.error('Intent detection error:', error)
    // 默认判断
    if (state.code && (state.userMessage.includes('改') || state.userMessage.includes('修'))) {
      return 'code_optimization'
    }
    return 'chat'
  }
}

// Mike 的决策节点
async function supervisorNode(state: ProjectState): Promise<ProjectState> {
  // 先进行意图理解
  const intent = await detectIntent(state)
  state.intent = intent
  
  console.log(`[Supervisor] Detected intent: ${intent}`)
  
  // 如果是闲聊/QA，直接让Mike回答
  if (intent === 'chat') {
    return {
      ...state,
      nextAgent: 'mike',
      currentStatus: 'chatting',
    }
  }
  
  // 如果是代码优化，且已有代码，直接让Alex处理
  if (intent === 'code_optimization' && state.code) {
    console.log('[Supervisor] Code optimization detected, routing to Alex')
    return {
      ...state,
      nextAgent: 'alex',
      currentStatus: 'coding',
      isModification: true,
    }
  }
  
  // 如果是新项目或需要完整流程
  const historyContext = state.conversationHistory && state.conversationHistory.length > 0
    ? `\n\n对话历史:\n${state.conversationHistory.slice(-5).map(msg => 
        `${msg.role === 'user' ? '用户' : msg.agent || 'AI'}: ${msg.content}`
      ).join('\n')}`
    : ''
  
  const modificationHint = state.isModification 
    ? '\n\n⚠️ 注意：这是一个修改需求，请判断是否需要重新生成 PRD/架构，还是只需要修改代码。'
    : ''
  
  const prompt = `你是 Atoms 团队的 Team Leader Mike。

用户需求: ${state.userMessage}${historyContext}${modificationHint}

当前状态: ${state.currentStatus}
已完成工作: 
- PRD: ${state.prd ? '✅' : '❌'}
- 架构设计: ${state.architecture ? '✅' : '❌'}
- 代码生成: ${state.code ? '✅' : '❌'}

请决定下一步行动:
1. 如果需要 PRD,返回 "emma"
2. 如果需要架构设计,返回 "bob"
3. 如果需要编码或修复代码,返回 "alex"
4. 如果已完成,返回 "complete"

${state.isModification ? '如果是小修改（如改颜色、文字），可能只需要 "alex"。如果是大改动，可能需要重新生成 PRD/架构。' : ''}

只返回智能体名称,不要额外解释。`

  try {
    const response = await getModel().invoke(prompt)
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content)
    const nextAgent = content.trim().toLowerCase() as any
    
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
    let fullContent = ''
    
    // 使用流式 API
    const stream = await getModel().stream(prompt)
    
    for await (const chunk of stream) {
      const chunkContent = typeof chunk.content === 'string' 
        ? chunk.content 
        : JSON.stringify(chunk.content)
      fullContent += chunkContent
      
      // 实时 yield 生成的内容
      yield {
        type: 'content_chunk',
        content: chunkContent,
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
    let fullContent = ''
    
    // 使用流式 API
    const stream = await getModel().stream(prompt)
    
    for await (const chunk of stream) {
      const chunkContent = typeof chunk.content === 'string' 
        ? chunk.content 
        : JSON.stringify(chunk.content)
      fullContent += chunkContent
      
      // 实时 yield 生成的内容
      yield {
        type: 'content_chunk',
        content: chunkContent,
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
    const response = await getModel().invoke(prompt)
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content)
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
  
  const prompt = `作为架构师 Bob,为以下项目设计精简的技术架构:

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
    let fullContent = ''
    
    // 使用流式 API
    const stream = await getModel().stream(prompt)
    
    for await (const chunk of stream) {
      const chunkContent = typeof chunk.content === 'string' 
        ? chunk.content 
        : JSON.stringify(chunk.content)
      fullContent += chunkContent
      
      // 实时 yield 生成的内容
      yield {
        type: 'content_chunk',
        content: chunkContent,
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
    const response = await getModel().invoke(prompt)
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content)
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
    ? `\n\n⚠️ 注意：这是对现有项目的修改。之前的代码文件:\n${Object.entries(state.code).map(([file, content]) => 
        `\n${file}:\n${content.substring(0, 500)}${content.length > 500 ? '...' : ''}`
      ).join('\n')}\n\n请根据新的需求修改代码，保留仍然适用的部分。`
    : ''
  
  // 如果是修改场景，只输出需要修改的diff部分
  const isModification = state.isModification && state.code
  const prompt = isModification
    ? `作为工程师 Alex,根据以下需求修改现有代码:

原始需求: ${state.originalUserMessage || state.userMessage.split('\n\n⚠️')[0].split('\n\n🔍')[0]}
${state.userMessage.includes('⚠️ 修复要求') ? `修复要求: ${state.userMessage.split('⚠️ 修复要求：')[1]?.split('\n\n请确保')[0] || ''}` : ''}
PRD: ${state.prd || '暂无'}
架构: ${state.architecture || '暂无'}${historyContext}${modificationContext}

⚠️ 重要：这是代码修改任务。请按以下步骤输出:

⚠️ 关键要求：只生成代码，不要包含任何错误信息文本、验证反馈或问题描述。生成的代码必须是完整的、可运行的 React 组件。

第一步：先输出修改说明（简洁，1-2句话说明修改内容）

第二步：只输出需要修改的部分，使用 diff 格式:
- 只列出需要修改的文件名
- 对于每个文件，只输出修改的行，使用以下格式:
  - 删除的行用 "- " 前缀
  - 新增的行用 "+ " 前缀
  - 未修改的行不要输出

示例:
修改说明: 将按钮颜色改为蓝色，添加点击事件

\`\`\`diff
文件: App.tsx
- <button>Click</button>
+ <button onClick={handleClick} style={{color: 'blue'}}>Click</button>
\`\`\`

第三步：最后用 JSON 格式返回修改后的完整文件内容（这一步在流式输出中会显示，但请保持简洁）:
{
  "App.tsx": "完整代码内容",
  "index.css": "完整样式内容（如有修改）"
}

注意：在流式输出时，优先显示修改说明和diff部分，完整代码可以放在最后。`
    : `作为工程师 Alex,为以下项目生成代码:

用户需求: ${state.originalUserMessage || state.userMessage.split('\n\n⚠️')[0].split('\n\n🔍')[0]}
PRD: ${state.prd || '暂无'}
架构: ${state.architecture || '暂无'}${historyContext}
${state.userMessage.includes('⚠️ 修复要求') ? `\n\n修复要求: ${state.userMessage.split('⚠️ 修复要求：')[1]?.split('\n\n请确保')[0] || ''}` : ''}

⚠️ 重要：请生成完整的、可运行的 React 代码，不要包含任何错误信息文本或验证反馈内容。

请生成一个简单的 React 应用，包含:
1. 主页面组件 (App.tsx)
2. 样式文件 (index.css)
3. package.json

代码应该是可以直接运行的。用 JSON 格式返回，格式如下:
{
  "App.tsx": "代码内容",
  "index.css": "样式内容",
  "package.json": "package.json 内容"
}

注意：只返回代码，不要返回错误信息、验证反馈或其他文本内容。`

  try {
    let fullContent = ''
    
    // 使用流式 API
    const stream = await getModel().stream(prompt)
    
    for await (const chunk of stream) {
      const chunkContent = typeof chunk.content === 'string' 
        ? chunk.content 
        : JSON.stringify(chunk.content)
      fullContent += chunkContent
      
      // 实时 yield 生成的内容
      yield {
        type: 'content_chunk',
        content: chunkContent,
      }
    }
    
    // 解析代码
    let code: Record<string, string> = {}
    try {
      // 尝试提取 JSON 代码块（可能包含在 markdown 代码块中）
      let jsonContent = fullContent
      
      // 移除可能的 markdown 代码块标记
      jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*/g, '')
      
      // 移除可能的错误信息文本（如果 LLM 错误地包含了验证反馈）
      jsonContent = jsonContent.replace(/🔍\s*验证发现问题[^\n]*\n/g, '')
      jsonContent = jsonContent.replace(/⚠️\s*验证发现问题[^\n]*\n/g, '')
      jsonContent = jsonContent.replace(/请修复这些问题[^\n]*\n/g, '')
      
      // 查找 JSON 对象
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        // 验证解析出的代码不包含错误信息
        const codeKeys = Object.keys(parsed)
        const hasValidCode = codeKeys.some(key => {
          const content = parsed[key]
          return typeof content === 'string' && 
                 content.length > 50 && 
                 !content.includes('🔍 验证发现问题') &&
                 !content.includes('⚠️ 验证发现问题') &&
                 !content.includes('页面完全空白')
        })
        
        if (hasValidCode) {
          code = parsed
        } else {
          throw new Error('Parsed code contains error messages, not valid code')
        }
      } else {
        throw new Error('No JSON code block found')
      }
    } catch (error) {
      console.warn('Failed to parse code from LLM response, using fallback:', error)
      // 如果解析失败，使用之前的代码（如果是修复）或生成默认代码
      if (state.code && Object.keys(state.code).length > 0) {
        // 修复场景：保留之前的代码，但添加提示
        code = state.code
        console.warn('Using previous code as fallback for repair')
      } else {
        // 新项目：生成默认代码
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
    ? `\n\n⚠️ 注意：这是对现有项目的修改。之前的代码文件:\n${Object.entries(state.code).map(([file, content]) => 
        `\n${file}:\n${content.substring(0, 500)}${content.length > 500 ? '...' : ''}`
      ).join('\n')}\n\n请根据新的需求修改代码，保留仍然适用的部分。`
    : ''
  
  const prompt = isModification
    ? `作为工程师 Alex,根据以下需求修改现有代码:

用户需求: ${state.userMessage}
PRD: ${state.prd || '暂无'}
架构: ${state.architecture || '暂无'}${modificationContext}

⚠️ 重要：这是代码修改任务。请按以下步骤输出:

第一步：先输出修改说明（简洁，1-2句话说明修改内容）

第二步：只输出需要修改的部分，使用 diff 格式:
- 只列出需要修改的文件名
- 对于每个文件，只输出修改的行，使用以下格式:
  - 删除的行用 "- " 前缀
  - 新增的行用 "+ " 前缀
  - 未修改的行不要输出

示例:
修改说明: 将按钮颜色改为蓝色，添加点击事件

\`\`\`diff
文件: App.tsx
- <button>Click</button>
+ <button onClick={handleClick} style={{color: 'blue'}}>Click</button>
\`\`\`

第三步：最后用 JSON 格式返回修改后的完整文件内容（这一步在流式输出中会显示，但请保持简洁）:
{
  "App.tsx": "完整代码内容",
  "index.css": "完整样式内容（如有修改）"
}

注意：在流式输出时，优先显示修改说明和diff部分，完整代码可以放在最后。`
    : `作为工程师 Alex,为以下项目生成代码:

用户需求: ${state.userMessage}
PRD: ${state.prd || '暂无'}
架构: ${state.architecture || '暂无'}

请生成一个简单的 React 应用，包含:
1. 主页面组件 (App.tsx)
2. 样式文件 (index.css)
3. package.json

代码应该是可以直接运行的。用 JSON 格式返回，格式如下:
{
  "App.tsx": "代码内容",
  "index.css": "样式内容",
  "package.json": "package.json 内容"
}`

  try {
    const response = await getModel().invoke(prompt)
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content)
    let code: Record<string, string> = {}
    
    try {
      // 尝试解析 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        code = JSON.parse(jsonMatch[0])
      } else {
        // 如果解析失败，创建默认代码
        code = {
          'App.tsx': `import React from 'react';\n\nexport default function App() {\n  return (\n    <div>\n      <h1>${state.userMessage}</h1>\n    </div>\n  );\n}`,
          'index.css': 'body { margin: 0; padding: 20px; font-family: sans-serif; }',
          'package.json': JSON.stringify({ name: 'app', version: '1.0.0', dependencies: { react: '^18.0.0' } }, null, 2),
        }
      }
    } catch {
      // 如果解析失败，使用默认代码
      code = {
        'App.tsx': `import React from 'react';\n\nexport default function App() {\n  return (\n    <div>\n      <h1>${state.userMessage}</h1>\n    </div>\n  );\n}`,
        'index.css': 'body { margin: 0; padding: 20px; font-family: sans-serif; }',
        'package.json': JSON.stringify({ name: 'app', version: '1.0.0', dependencies: { react: '^18.0.0' } }, null, 2),
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
      // 如果表不存在，返回 null（首次运行）
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        console.warn('project_states table does not exist yet, please run database migration')
        return null
      }
      console.error('Load project state error:', error)
      return null
    }
    
    if (!data || !data.state) return null
    
    // state 可能是 JSONB，直接返回或解析
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
        state: stateToSave, // Supabase JSONB 可以直接接受对象
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,user_id'
      })
    
    if (error) {
      // 如果表不存在，只记录警告（首次运行）
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

// 判断是否为修改需求
function isModificationRequest(userMessage: string, previousState: Partial<ProjectState> | null): boolean {
  if (!previousState || (!previousState.prd && !previousState.code)) {
    return false // 没有之前的状态，肯定是新需求
  }
  
  // 检查是否包含修改相关的关键词
  const modificationKeywords = ['修改', '改成', '改为', '调整', '更新', '改', '换', 'change', 'modify', 'update', 'adjust']
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
  // 尝试加载之前的状态
  const previousState = await loadProjectState(projectId)
  const isModification = isModificationRequest(userMessage, previousState)
  
  let state: ProjectState = {
    userMessage,
    currentStatus: previousState?.currentStatus || 'planning',
    prd: previousState?.prd,
    architecture: previousState?.architecture,
    code: previousState?.code,
    conversationHistory: conversationHistory || [],
    isModification,
    originalUserMessage: userMessage, // 保存原始用户需求
  }

  const maxIterations = 10
  let iterations = 0

  // 发送开始消息
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

    // Supervisor 决定下一步
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

    // 如果是Mike自己回答（闲聊/QA）
    if (state.nextAgent === 'mike') {
      yield {
        type: 'agent_start',
        agent: 'mike',
        content: `💬 **Mike (Team Leader)** 正在回答...`,
      }
      
      let accumulatedContent = `💬 **Mike (Team Leader)** 正在回答...\n\n`
      const chatStream = mikeChatNodeStream(state)
      
      let fullContent = ''
      for await (const chunk of chatStream) {
        if ('type' in chunk && chunk.type === 'content_chunk') {
          fullContent += chunk.content
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
      
      // 闲聊完成后，直接结束
      yield {
        type: 'complete',
        agent: 'mike',
        content: accumulatedContent,
      }
      
      state.currentStatus = 'complete'
      break
    }

    // 执行对应的智能体
    if (state.nextAgent === 'emma' && !state.prd) {
      yield {
        type: 'agent_start',
        agent: 'emma',
        content: `📋 **Emma (产品经理)** 正在分析需求...`,
      }
      
      // 使用流式生成
      let accumulatedContent = `📋 **Emma (产品经理)** 正在分析需求...\n\n`
      const prdStream = emmaPRDNodeStream(state)
      
      let fullContent = ''
      for await (const chunk of prdStream) {
        if ('type' in chunk && chunk.type === 'content_chunk') {
          fullContent += chunk.content
          accumulatedContent += chunk.content
          // 实时 yield 生成的内容
          yield {
            type: 'content_update',
            agent: 'emma',
            content: accumulatedContent,
          }
        }
      }
      
      // 流式生成器结束后，手动获取返回值
      // 注意：async generator 的 return 值需要通过特殊方式获取
      // 这里我们直接使用累积的内容更新状态
      if (fullContent) {
        state = {
          ...state,
          prd: fullContent,
          currentStatus: 'designing',
        }
        console.log('Emma PRD generated, length:', fullContent.length)
      } else {
        console.warn('Emma PRD stream ended but no content received')
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
      
      // 使用流式生成
      let accumulatedContent = `🏗️ **Bob (架构师)** 正在设计架构...\n\n`
      const archStream = bobArchitectureNodeStream(state)
      
      let fullContent = ''
      for await (const chunk of archStream) {
        if ('type' in chunk && chunk.type === 'content_chunk') {
          fullContent += chunk.content
          accumulatedContent += chunk.content
          // 实时 yield 生成的内容
          yield {
            type: 'content_update',
            agent: 'bob',
            content: accumulatedContent,
          }
        }
      }
      
      // 流式生成器结束后，手动更新状态
      if (fullContent) {
        state = {
          ...state,
          architecture: fullContent,
          currentStatus: 'coding',
        }
        console.log('Bob architecture generated, length:', fullContent.length)
      } else {
        console.warn('Bob architecture stream ended but no content received')
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
      
      // 使用流式生成
      let accumulatedContent = isFixing
        ? `🔧 **Alex (工程师)** 正在修复代码...\n\n`
        : `💻 **Alex (工程师)** 正在生成代码...\n\n`
      const codeStream = alexCodeGenNodeStream(state)
      
      let fullContent = ''
      for await (const chunk of codeStream) {
        if ('type' in chunk && chunk.type === 'content_chunk') {
          fullContent += chunk.content
          accumulatedContent += chunk.content
          // 实时 yield 生成的内容
          yield {
            type: 'content_update',
            agent: 'alex',
            content: accumulatedContent,
          }
        }
      }
      
      // 流式生成器结束后，解析代码并更新状态
      if (fullContent) {
        try {
          // 尝试解析 JSON 格式的代码
          const jsonMatch = fullContent.match(/\{[\s\S]*\}/)
          let code: Record<string, string> = {}
          
          if (jsonMatch) {
            code = JSON.parse(jsonMatch[0])
          } else {
            // 如果解析失败，创建默认代码
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
          // 使用默认代码
          state = {
            ...state,
            code: {
              'App.tsx': `import React from 'react';\n\nexport default function App() {\n  return <div><h1>${state.userMessage}</h1></div>;\n}`,
            },
            currentStatus: 'complete',
          }
        }
      } else {
        console.warn('Alex code stream ended but no content received')
      }
      
      // 代码生成后，尝试创建沙盒并部署
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
                // 写入文件到沙盒
                for (const [filePath, content] of Object.entries(state.code)) {
                  await sandboxService.writeFile(sandboxResult.containerId, filePath, content)
                }
                
                // 如果有 package.json，安装依赖
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
                
                // 尝试启动服务（如果有启动脚本）
                if (state.code['package.json']) {
                  try {
                    const pkg = JSON.parse(state.code['package.json'])
                    if (pkg.scripts && pkg.scripts.start) {
                      await sandboxService.runCommand(
                        sandboxResult.containerId,
                        'cd /workspace && npm start',
                        false
                      )
                    }
                  } catch (error) {
                    console.error('Failed to start server:', error)
                  }
                }
                
                sandboxInfo = {
                  sandboxId: sandboxResult.containerId,
                  vncUrl: sandboxResult.vncUrl,
                  websiteUrl: sandboxResult.websiteUrl,
                }
              }
            } catch (error) {
              console.error('Failed to create sandbox:', error)
              // 继续使用浏览器预览
            }
          }
        } catch (error) {
          console.error('Sandbox service error:', error)
        }
      }
      
      const sandboxNote = sandboxInfo
        ? `\n\n🌐 **应用已部署到沙盒环境**\n- 访问地址: ${sandboxInfo.websiteUrl}\n- VNC 远程桌面: ${sandboxInfo.vncUrl}`
        : ''
      
      // 生成代码 artifact
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
      
      // 代码生成后，自动验证预览（无论是否有沙盒 URL）
      if (state.code) {
        yield {
          type: 'agent_start',
          agent: 'mike',
          content: `🔍 **Mike (Team Leader)** 正在验证预览页面...`,
        }
        
        try {
          const { verifyPreview, generateVerificationFeedback } = await import('../services/verify')
          
          // 优先使用沙盒 URL，否则使用代码生成预览
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
            // 发现问题，需要修复
            yield {
              type: 'agent_start',
              agent: 'mike',
              content: feedback,
            }
            
            // 自动触发修复流程
            state.currentStatus = 'coding'
            state.nextAgent = 'alex'
            // 保存原始用户消息（如果还没有保存）
            if (!state.originalUserMessage) {
              state.originalUserMessage = state.userMessage
            }
            // 将问题添加到用户消息中，触发修复（但保持原始需求清晰）
            const issuesText = verifyResult.issues.length > 0 
              ? verifyResult.issues.join('\n')
              : '预览页面存在问题，需要修复'
            // 使用原始需求 + 修复指令，而不是直接追加错误信息
            const originalReq = state.originalUserMessage || state.userMessage.split('\n\n🔍')[0]
            state.userMessage = `${originalReq}\n\n⚠️ 修复要求：预览页面验证发现问题，请修复以下问题：\n${issuesText}\n\n请确保生成的代码是完整的、可运行的 React 组件，不要包含错误信息文本。`
            state.isModification = true // 标记为修改模式
            
            // 继续迭代修复（不 break，继续循环）
            continue
          } else {
            // 验证通过或只有建议
            yield {
              type: 'agent_complete',
              agent: 'mike',
              content: feedback,
            }
          }
        } catch (error) {
          console.error('Verification error:', error)
          const verifyErrorMsg = error instanceof Error ? error.message : String(error)
          yield {
            type: 'agent_complete',
            agent: 'mike',
            content: `⚠️ 验证过程遇到问题: ${verifyErrorMsg}。代码已生成，请手动检查预览页面。`,
          }
        }
      }
      
      // 代码生成后，检查是否完成（验证通过后）
      // 注意：验证可能会触发修复，所以这里不直接设置 complete
      // 只有在验证通过或没有验证时才完成
      if (state.code) {
        // 如果验证没有触发修复（currentStatus 不是 'coding'），说明验证通过或没有验证
        // 设置状态为完成
        if (state.currentStatus !== 'coding') {
          state.currentStatus = 'complete'
          console.log('Setting status to complete after code generation and verification')
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
        } else {
          // 验证触发了修复，继续循环
          console.log('Verification triggered fix, continuing loop')
        }
      }
      continue
    }

    // 如果都完成了
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
    
    // 定期保存状态（每次迭代后）
    await saveProjectState(projectId, userId, state)
  }
  
  // 最终保存状态
  await saveProjectState(projectId, userId, state)
}

// 简化的工作流实现（保留用于兼容）
export function createMikeAgent() {
  return {
    async invoke({ userMessage, projectId, userId }: {
      userMessage: string
      projectId: string
      userId: string
    }): Promise<AgentResponse> {
      // 使用流式工作流，但收集所有结果
      const results: any[] = []
      for await (const chunk of invokeStream({ userMessage, projectId, userId })) {
        results.push(chunk)
      }
      
      // 返回最后一个完整的结果
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
    
    // 流式接口
    invokeStream,
  }
}
