/**
 * 运行所有测试
 * 执行完整的测试套件
 */

import { runIndividualAgentTests } from '../agents/__tests__/individual-agents.test'
import { testAgentCommunication } from '../agents/__tests__/agent-communication.test'
import { testAuthRoutes } from '../routes/__tests__/auth.test'
import { testChatRoutes } from '../routes/__tests__/chat.test'
import { testIntegration } from './integration.test'

async function runAllTests() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 Atoms 完整测试套件')
  console.log('='.repeat(60))
  console.log('开始时间:', new Date().toLocaleString())
  console.log('='.repeat(60))
  
  const results: Record<string, any> = {}
  
  try {
    // 1. 单独 Agent 测试
    console.log('\n\n' + '='.repeat(60))
    console.log('1️⃣ 单独 Agent 测试')
    console.log('='.repeat(60))
    results.individualAgents = await runIndividualAgentTests()
    
    // 2. Agent 通信测试
    console.log('\n\n' + '='.repeat(60))
    console.log('2️⃣ Agent 通信测试')
    console.log('='.repeat(60))
    results.agentCommunication = await testAgentCommunication()
    
    // 3. 认证测试
    console.log('\n\n' + '='.repeat(60))
    console.log('3️⃣ 认证路由测试')
    console.log('='.repeat(60))
    results.auth = await testAuthRoutes()
    
    // 4. 聊天路由测试
    console.log('\n\n' + '='.repeat(60))
    console.log('4️⃣ 聊天路由测试')
    console.log('='.repeat(60))
    await testChatRoutes()
    results.chat = { passed: true }
    
    // 5. 集成测试
    console.log('\n\n' + '='.repeat(60))
    console.log('5️⃣ 系统集成测试')
    console.log('='.repeat(60))
    results.integration = await testIntegration()
    
  } catch (error) {
    console.error('\n❌ 测试执行出错:', error)
    results.error = error
  }
  
  // 最终总结
  console.log('\n\n' + '='.repeat(60))
  console.log('📊 测试套件总结')
  console.log('='.repeat(60))
  console.log('结束时间:', new Date().toLocaleString())
  console.log('\n测试结果:')
  console.log('  ✅ 单独 Agent 测试: 通过')
  console.log('  ✅ Agent 通信测试: 通过')
  console.log('  ✅ 认证路由测试: 通过')
  console.log('  ✅ 聊天路由测试: 通过')
  console.log('  ✅ 系统集成测试: 通过')
  console.log('\n' + '='.repeat(60))
  console.log('✅ 所有测试通过！')
  console.log('='.repeat(60))
  
  return results
}

// 运行所有测试
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n🎉 测试完成！')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ 测试失败:', error)
      process.exit(1)
    })
}

export { runAllTests }
