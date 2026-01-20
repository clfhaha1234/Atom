/**
 * Agent 之间通信测试
 * 验证 Agent 之间的信息传递机制
 */

import { TestMikeAgent } from './mike.test'

async function testAgentCommunication() {
  console.log('\n' + '='.repeat(60))
  console.log('🔗 Agent 之间通信测试')
  console.log('='.repeat(60))
  
  const agent = new TestMikeAgent()
  
  // 测试 1: 验证 Emma → Bob 通信
  console.log('\n📝 测试 1: Emma → Bob 信息传递')
  console.log('-'.repeat(60))
  
  const result1 = await agent.testFullWorkflow('做一个博客系统')
  
  // 检查 Bob 是否能看到 Emma 的 PRD
  const bobCanSeePRD = result1.state.architecture && result1.state.prd
  console.log(`\n✅ Emma → Bob 通信: ${bobCanSeePRD ? '通过' : '失败'}`)
  console.log(`   Bob 执行时 PRD 存在: ${bobCanSeePRD ? '✅' : '❌'}`)
  
  // 测试 2: 验证 Emma + Bob → Alex 通信
  console.log('\n📝 测试 2: Emma + Bob → Alex 信息传递')
  console.log('-'.repeat(60))
  
  const result2 = await agent.testFullWorkflow('做一个电商平台')
  
  // 检查 Alex 是否能看到 PRD 和架构
  const alexCanSeeBoth = result2.state.code && 
                         result2.state.prd && 
                         result2.state.architecture
  console.log(`\n✅ Emma + Bob → Alex 通信: ${alexCanSeeBoth ? '通过' : '失败'}`)
  console.log(`   Alex 执行时 PRD 存在: ${result2.state.prd ? '✅' : '❌'}`)
  console.log(`   Alex 执行时架构存在: ${result2.state.architecture ? '✅' : '❌'}`)
  
  // 测试 3: 验证状态传递顺序
  console.log('\n📝 测试 3: 状态传递顺序验证')
  console.log('-'.repeat(60))
  
  const result3 = await agent.testFullWorkflow('做一个计算器')
  
  const correctOrder = result3.steps.length === 3 &&
                       result3.steps[0].agent === 'Emma' &&
                       result3.steps[1].agent === 'Bob' &&
                       result3.steps[2].agent === 'Alex'
  
  console.log(`\n✅ 状态传递顺序: ${correctOrder ? '通过' : '失败'}`)
  console.log(`   执行顺序: ${result3.steps.map(s => s.agent).join(' → ')}`)
  console.log(`   顺序正确: ${correctOrder ? '✅' : '❌'}`)
  
  // 测试 4: 验证状态更新
  console.log('\n📝 测试 4: 状态更新验证')
  console.log('-'.repeat(60))
  
  const result4 = await agent.testFullWorkflow('做一个待办事项应用')
  
  // 检查每个步骤后状态是否正确更新
  const stateUpdates = {
    afterEmma: result4.steps[0]?.state.prd ? '✅' : '❌',
    afterBob: result4.steps[1]?.state.architecture ? '✅' : '❌',
    afterAlex: result4.steps[2]?.state.code ? '✅' : '❌',
  }
  
  console.log(`\n✅ 状态更新验证: ${Object.values(stateUpdates).every(v => v === '✅') ? '通过' : '失败'}`)
  console.log(`   Emma 后 PRD 更新: ${stateUpdates.afterEmma}`)
  console.log(`   Bob 后架构更新: ${stateUpdates.afterBob}`)
  console.log(`   Alex 后代码更新: ${stateUpdates.afterAlex}`)
  
  // 总结
  console.log('\n' + '='.repeat(60))
  console.log('📊 通信测试总结')
  console.log('='.repeat(60))
  console.log(`✅ Emma → Bob: ${bobCanSeePRD ? '通过' : '失败'}`)
  console.log(`✅ Emma + Bob → Alex: ${alexCanSeeBoth ? '通过' : '失败'}`)
  console.log(`✅ 状态传递顺序: ${correctOrder ? '通过' : '失败'}`)
  console.log(`✅ 状态更新: ${Object.values(stateUpdates).every(v => v === '✅') ? '通过' : '失败'}`)
  
  return {
    emmaToBob: bobCanSeePRD,
    emmaBobToAlex: alexCanSeeBoth,
    correctOrder,
    stateUpdates,
  }
}

// 运行测试
if (require.main === module) {
  testAgentCommunication().catch(console.error)
}

export { testAgentCommunication }
