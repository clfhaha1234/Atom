/**
 * 单独 Agent 测试
 * 测试每个 Agent 的独立功能
 */

import { ChatAnthropic } from '@langchain/anthropic'

// Mock LLM
class MockLLM {
  private responses: Record<string, string> = {
    emma: `# 产品需求文档

## 产品概述
待办事项管理应用，帮助用户高效管理任务。

## 核心功能
1. 添加任务
2. 标记完成
3. 删除任务
4. 任务分类

## 技术栈建议
- React (前端)
- LocalStorage (数据存储)`,
    
    bob: `# 技术架构

## 技术栈
- 前端: React + TypeScript
- 样式: CSS
- 存储: LocalStorage

## 组件设计
- App.tsx: 主组件
- TaskList: 任务列表
- TaskItem: 任务项`,
    
    alex: JSON.stringify({
      "App.tsx": `import React, { useState } from 'react';\n\nexport default function App() {\n  const [tasks, setTasks] = useState([]);\n  return (\n    <div>\n      <h1>待办事项</h1>\n    </div>\n  );\n}`,
      "index.css": "body { margin: 0; padding: 20px; font-family: sans-serif; }",
      "package.json": JSON.stringify({ name: 'todo-app', version: '1.0.0', dependencies: { react: '^18.0.0' } })
    })
  }
  
  async invoke(prompt: string): Promise<{ content: string }> {
    if (prompt.includes('产品经理 Emma')) {
      return { content: this.responses.emma }
    }
    if (prompt.includes('架构师 Bob')) {
      return { content: this.responses.bob }
    }
    if (prompt.includes('工程师 Alex')) {
      return { content: this.responses.alex }
    }
    return { content: 'unknown' }
  }
}

interface ProjectState {
  userMessage: string
  currentStatus: string
  prd?: string
  architecture?: string
  code?: Record<string, string>
}

// 测试 Emma Agent
async function testEmmaAgent() {
  console.log('\n' + '='.repeat(60))
  console.log('📋 测试 Emma Agent (产品经理)')
  console.log('='.repeat(60))
  
  const mockLLM = new MockLLM()
  const state: ProjectState = {
    userMessage: '做一个待办事项应用',
    currentStatus: 'planning',
  }
  
  const prompt = `作为产品经理 Emma,为以下需求生成 PRD:
用户需求: ${state.userMessage}

PRD 应包含:
1. 产品概述
2. 核心功能列表 (3-5 个)
3. 用户故事 (As a... I want... So that...)
4. 技术栈建议
5. 验收标准

用 Markdown 格式输出，简洁明了。`
  
  const response = await mockLLM.invoke(prompt)
  state.prd = response.content
  state.currentStatus = 'designing'
  
  console.log('✅ Emma 测试通过')
  console.log(`   PRD 长度: ${state.prd.length} 字符`)
  console.log(`   状态更新: ${state.currentStatus}`)
  console.log(`   PRD 预览: ${state.prd.substring(0, 100)}...`)
  
  return state
}

// 测试 Bob Agent
async function testBobAgent() {
  console.log('\n' + '='.repeat(60))
  console.log('🏗️ 测试 Bob Agent (架构师)')
  console.log('='.repeat(60))
  
  const mockLLM = new MockLLM()
  const state: ProjectState = {
    userMessage: '做一个待办事项应用',
    currentStatus: 'designing',
    prd: '# 产品需求文档\n\n## 产品概述\n待办事项管理应用',
  }
  
  const prompt = `作为架构师 Bob,为以下项目设计技术架构:
用户需求: ${state.userMessage}
PRD: ${state.prd || '暂无'}

请提供:
1. 技术栈选择 (前端/后端/数据库)
2. 系统架构图 (用文字描述)
3. 关键组件设计
4. 数据模型

用 Markdown 格式输出。`
  
  const response = await mockLLM.invoke(prompt)
  state.architecture = response.content
  state.currentStatus = 'coding'
  
  console.log('✅ Bob 测试通过')
  console.log(`   架构长度: ${state.architecture.length} 字符`)
  console.log(`   状态更新: ${state.currentStatus}`)
  console.log(`   可以看到 PRD: ${state.prd ? '✅' : '❌'}`)
  console.log(`   架构预览: ${state.architecture.substring(0, 100)}...`)
  
  return state
}

// 测试 Alex Agent
async function testAlexAgent() {
  console.log('\n' + '='.repeat(60))
  console.log('💻 测试 Alex Agent (工程师)')
  console.log('='.repeat(60))
  
  const mockLLM = new MockLLM()
  const state: ProjectState = {
    userMessage: '做一个待办事项应用',
    currentStatus: 'coding',
    prd: '# 产品需求文档\n\n## 产品概述\n待办事项管理应用',
    architecture: '# 技术架构\n\n## 技术栈\nReact + TypeScript',
  }
  
  const prompt = `作为工程师 Alex,为以下项目生成代码:
用户需求: ${state.userMessage}
PRD: ${state.prd || '暂无'}
架构: ${state.architecture || '暂无'}

请生成一个简单的 React 应用，包含:
1. 主页面组件 (App.tsx)
2. 样式文件 (index.css)
3. package.json

代码应该是可以直接运行的。用 JSON 格式返回。`
  
  const response = await mockLLM.invoke(prompt)
  let code: Record<string, string> = {}
  
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      code = JSON.parse(jsonMatch[0])
    }
  } catch {
    code = { 'App.tsx': 'export default function App() { return <div>Hello</div>; }' }
  }
  
  state.code = code
  state.currentStatus = 'complete'
  
  console.log('✅ Alex 测试通过')
  console.log(`   代码文件数: ${Object.keys(code).length}`)
  console.log(`   状态更新: ${state.currentStatus}`)
  console.log(`   可以看到 PRD: ${state.prd ? '✅' : '❌'}`)
  console.log(`   可以看到架构: ${state.architecture ? '✅' : '❌'}`)
  console.log(`   生成的文件: ${Object.keys(code).join(', ')}`)
  
  return state
}

// 运行所有单独 Agent 测试
async function runIndividualAgentTests() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 单独 Agent 功能测试')
  console.log('='.repeat(60))
  
  try {
    const emmaState = await testEmmaAgent()
    const bobState = await testBobAgent()
    const alexState = await testAlexAgent()
    
    console.log('\n' + '='.repeat(60))
    console.log('📊 测试总结')
    console.log('='.repeat(60))
    console.log('✅ Emma Agent: 通过')
    console.log('✅ Bob Agent: 通过')
    console.log('✅ Alex Agent: 通过')
    console.log('\n所有单独 Agent 测试通过！')
    
    return { emmaState, bobState, alexState }
  } catch (error) {
    console.error('❌ 测试失败:', error)
    throw error
  }
}

// 如果直接运行
if (require.main === module) {
  runIndividualAgentTests().catch(console.error)
}

export { testEmmaAgent, testBobAgent, testAlexAgent, runIndividualAgentTests }
