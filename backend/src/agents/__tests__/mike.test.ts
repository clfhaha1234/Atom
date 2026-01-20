/**
 * Mike Agent 离线测试方案
 * 
 * 测试目标：
 * 1. 验证 Supervisor 决策逻辑
 * 2. 验证 Agent 协作流程
 * 3. 验证状态传递机制
 * 4. 验证完成判断逻辑
 */

// Mock LLM 响应
const mockLLMResponses: Record<string, string> = {
  // Supervisor 决策
  'supervisor_no_prd': 'emma',
  'supervisor_no_arch': 'bob',
  'supervisor_no_code': 'alex',
  'supervisor_complete': 'complete',
  
  // Emma PRD
  'emma_prd': `# 产品需求文档

## 产品概述
待办事项管理应用，帮助用户高效管理任务。

## 核心功能
1. 添加任务
2. 标记完成
3. 删除任务
4. 任务分类

## 技术栈建议
- React (前端)
- LocalStorage (数据存储)
`,
  
  // Bob 架构
  'bob_arch': `# 技术架构

## 技术栈
- 前端: React + TypeScript
- 样式: CSS
- 存储: LocalStorage

## 组件设计
- App.tsx: 主组件
- TaskList: 任务列表
- TaskItem: 任务项
`,
  
  // Alex 代码
  'alex_code': JSON.stringify({
    "App.tsx": `import React, { useState } from 'react';\n\nexport default function App() {\n  const [tasks, setTasks] = useState([]);\n  return (\n    <div>\n      <h1>待办事项</h1>\n    </div>\n  );\n}`,
    "index.css": "body { margin: 0; padding: 20px; font-family: sans-serif; }",
    "package.json": JSON.stringify({ name: 'todo-app', version: '1.0.0', dependencies: { react: '^18.0.0' } })
  })
}

// Mock ChatAnthropic
class MockChatAnthropic {
  async invoke(prompt: string): Promise<{ content: string }> {
    // 根据 prompt 内容返回对应的 mock 响应
    if (prompt.includes('Team Leader Mike')) {
      if (prompt.includes('PRD: ❌')) {
        return { content: mockLLMResponses.supervisor_no_prd }
      }
      if (prompt.includes('架构设计: ❌')) {
        return { content: mockLLMResponses.supervisor_no_arch }
      }
      if (prompt.includes('代码生成: ❌')) {
        return { content: mockLLMResponses.supervisor_no_code }
      }
      return { content: mockLLMResponses.supervisor_complete }
    }
    
    if (prompt.includes('产品经理 Emma')) {
      return { content: mockLLMResponses.emma_prd }
    }
    
    if (prompt.includes('架构师 Bob')) {
      return { content: mockLLMResponses.bob_arch }
    }
    
    if (prompt.includes('工程师 Alex')) {
      return { content: mockLLMResponses.alex_code }
    }
    
    return { content: 'unknown' }
  }
}

// 测试辅助函数
interface ProjectState {
  userMessage: string
  currentStatus: 'planning' | 'designing' | 'coding' | 'deploying' | 'complete'
  prd?: string
  architecture?: string
  code?: Record<string, string>
  nextAgent?: 'emma' | 'bob' | 'alex' | 'complete'
}

// 简化的测试版本 Agent
class TestMikeAgent {
  private mockModel = new MockChatAnthropic()
  
  async supervisorNode(state: ProjectState): Promise<ProjectState> {
    const prompt = `你是 Atoms 团队的 Team Leader Mike。

用户需求: ${state.userMessage}
当前状态: ${state.currentStatus}
已完成工作: 
- PRD: ${state.prd ? '✅' : '❌'}
- 架构设计: ${state.architecture ? '✅' : '❌'}
- 代码生成: ${state.code ? '✅' : '❌'}

请决定下一步行动:
1. 如果需要 PRD,返回 "emma"
2. 如果需要架构设计,返回 "bob"
3. 如果需要编码,返回 "alex"
4. 如果已完成,返回 "complete"

只返回智能体名称,不要额外解释。`
    
    const response = await this.mockModel.invoke(prompt)
    const nextAgent = response.content.trim().toLowerCase() as any
    
    return {
      ...state,
      nextAgent: nextAgent || 'emma',
    }
  }
  
  async emmaPRDNode(state: ProjectState): Promise<ProjectState> {
    const prompt = `作为产品经理 Emma,为以下需求生成 PRD:
用户需求: ${state.userMessage}`
    
    const response = await this.mockModel.invoke(prompt)
    return {
      ...state,
      prd: response.content,
      currentStatus: 'designing',
    }
  }
  
  async bobArchitectureNode(state: ProjectState): Promise<ProjectState> {
    const prompt = `作为架构师 Bob,为以下项目设计技术架构:
用户需求: ${state.userMessage}
PRD: ${state.prd || '暂无'}`
    
    const response = await this.mockModel.invoke(prompt)
    return {
      ...state,
      architecture: response.content,
      currentStatus: 'coding',
    }
  }
  
  async alexCodeGenNode(state: ProjectState): Promise<ProjectState> {
    const prompt = `作为工程师 Alex,为以下项目生成代码:
用户需求: ${state.userMessage}
PRD: ${state.prd || '暂无'}
架构: ${state.architecture || '暂无'}`
    
    const response = await this.mockModel.invoke(prompt)
    let code: Record<string, string> = {}
    
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        code = JSON.parse(jsonMatch[0])
      } else {
        code = {
          'App.tsx': `import React from 'react';\nexport default function App() { return <div><h1>${state.userMessage}</h1></div>; }`,
        }
      }
    } catch {
      code = {
        'App.tsx': `import React from 'react';\nexport default function App() { return <div><h1>${state.userMessage}</h1></div>; }`,
      }
    }
    
    return {
      ...state,
      code,
      currentStatus: 'complete',
    }
  }
  
  async testFullWorkflow(userMessage: string) {
    console.log('\n🚀 开始测试完整工作流...\n')
    console.log(`📝 用户需求: ${userMessage}\n`)
    
    let state: ProjectState = {
      userMessage,
      currentStatus: 'planning',
    }
    
    const steps: Array<{ agent: string; action: string; state: ProjectState }> = []
    const maxIterations = 10
    let iterations = 0
    
    while (iterations < maxIterations && state.currentStatus !== 'complete') {
      iterations++
      console.log(`\n--- 迭代 ${iterations} ---`)
      console.log(`当前状态: ${state.currentStatus}`)
      console.log(`已完成: PRD=${!!state.prd}, 架构=${!!state.architecture}, 代码=${!!state.code}`)
      
      // Supervisor 决策
      console.log('\n👔 Mike (Supervisor) 正在决策...')
      state = await this.supervisorNode(state)
      console.log(`✅ Mike 决定: 下一步由 ${state.nextAgent} 执行`)
      
      if (state.nextAgent === 'complete') {
        console.log('\n🎉 项目完成！')
        break
      }
      
      // 执行对应 Agent
      let agentName = ''
      let action = ''
      
      if (state.nextAgent === 'emma' && !state.prd) {
        agentName = 'Emma'
        action = '生成 PRD'
        console.log(`\n📋 ${agentName} (产品经理) 开始工作...`)
        state = await this.emmaPRDNode(state)
        console.log(`✅ ${agentName} 完成: PRD 已生成 (${state.prd?.substring(0, 50)}...)`)
      } else if (state.nextAgent === 'bob' && !state.architecture) {
        agentName = 'Bob'
        action = '设计架构'
        console.log(`\n🏗️ ${agentName} (架构师) 开始工作...`)
        console.log(`   可以看到 Emma 的 PRD: ${state.prd ? '✅' : '❌'}`)
        state = await this.bobArchitectureNode(state)
        console.log(`✅ ${agentName} 完成: 架构设计已完成 (${state.architecture?.substring(0, 50)}...)`)
      } else if (state.nextAgent === 'alex' && !state.code) {
        agentName = 'Alex'
        action = '生成代码'
        console.log(`\n💻 ${agentName} (工程师) 开始工作...`)
        console.log(`   可以看到 Emma 的 PRD: ${state.prd ? '✅' : '❌'}`)
        console.log(`   可以看到 Bob 的架构: ${state.architecture ? '✅' : '❌'}`)
        state = await this.alexCodeGenNode(state)
        console.log(`✅ ${agentName} 完成: 代码已生成 (${Object.keys(state.code || {}).length} 个文件)`)
      }
      
      steps.push({ agent: agentName, action, state: { ...state } })
      
      // 检查完成条件
      if (state.prd && state.architecture && state.code) {
        console.log('\n✅ 所有工作已完成！')
        break
      }
    }
    
    // 输出最终结果
    console.log('\n' + '='.repeat(60))
    console.log('📊 工作流总结')
    console.log('='.repeat(60))
    console.log(`总迭代次数: ${iterations}`)
    console.log(`最终状态: ${state.currentStatus}`)
    console.log(`\n生成的内容:`)
    console.log(`- PRD: ${state.prd ? '✅ (' + state.prd.length + ' 字符)' : '❌'}`)
    console.log(`- 架构: ${state.architecture ? '✅ (' + state.architecture.length + ' 字符)' : '❌'}`)
    console.log(`- 代码: ${state.code ? '✅ (' + Object.keys(state.code).length + ' 个文件)' : '❌'}`)
    
    console.log(`\n工作步骤:`)
    steps.forEach((step, i) => {
      console.log(`${i + 1}. ${step.agent} - ${step.action}`)
    })
    
    return { state, steps, iterations }
  }
}

// 运行测试
async function runTests() {
  const agent = new TestMikeAgent()
  
  console.log('='.repeat(60))
  console.log('🧪 Atoms Agent 协作机制测试')
  console.log('='.repeat(60))
  
  // 测试 1: 完整流程
  await agent.testFullWorkflow('做一个待办事项应用')
  
  console.log('\n\n' + '='.repeat(60))
  console.log('✅ 测试完成')
  console.log('='.repeat(60))
}

// 如果直接运行此文件
// 使用 ts-node 运行: npx ts-node src/agents/__tests__/mike.test.ts
runTests().catch(console.error)

export { TestMikeAgent, runTests }
