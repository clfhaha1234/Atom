/**
 * 集成测试
 * 测试整个系统的端到端流程
 */

import { TestMikeAgent } from '../agents/__tests__/mike.test'
import { MockSupabase } from '../routes/__tests__/auth.test'

async function testIntegration() {
  console.log('\n' + '='.repeat(60))
  console.log('🔗 系统集成测试')
  console.log('='.repeat(60))
  
  // 测试场景: 完整用户流程
  console.log('\n📝 测试场景: 完整用户流程')
  console.log('-'.repeat(60))
  console.log('1. 用户注册')
  console.log('2. 用户登录')
  console.log('3. 发送聊天消息')
  console.log('4. Agent 协作生成代码')
  console.log('5. 查看生成结果')
  
  // 步骤 1: 用户注册
  console.log('\n--- 步骤 1: 用户注册 ---')
  const supabase = new MockSupabase()
  const signUpResult = await supabase.signUp('integration@test.com', 'password123')
  const userRegistered = signUpResult.data.user !== null
  console.log(`✅ 用户注册: ${userRegistered ? '成功' : '失败'}`)
  console.log(`   用户 ID: ${signUpResult.data.user?.id || 'N/A'}`)
  
  // 步骤 2: 用户登录
  console.log('\n--- 步骤 2: 用户登录 ---')
  const signInResult = await supabase.signIn('integration@test.com', 'password123')
  const userLoggedIn = signInResult.data.user !== null
  console.log(`✅ 用户登录: ${userLoggedIn ? '成功' : '失败'}`)
  console.log(`   用户 ID: ${signInResult.data.user?.id || 'N/A'}`)
  
  // 步骤 3: 发送聊天消息
  console.log('\n--- 步骤 3: 发送聊天消息 ---')
  const agent = new TestMikeAgent()
  const chatResult = await agent.testFullWorkflow('做一个待办事项应用')
  const messageProcessed = chatResult.state.prd && 
                          chatResult.state.architecture && 
                          chatResult.state.code
  console.log(`✅ 消息处理: ${messageProcessed ? '成功' : '失败'}`)
  console.log(`   生成 PRD: ${chatResult.state.prd ? '✅' : '❌'}`)
  console.log(`   生成架构: ${chatResult.state.architecture ? '✅' : '❌'}`)
  console.log(`   生成代码: ${chatResult.state.code ? '✅' : '❌'}`)
  
  // 步骤 4: 验证 Agent 协作
  console.log('\n--- 步骤 4: 验证 Agent 协作 ---')
  const agentsCollaborated = chatResult.steps.length === 3 &&
                              chatResult.steps[0].agent === 'Emma' &&
                              chatResult.steps[1].agent === 'Bob' &&
                              chatResult.steps[2].agent === 'Alex'
  console.log(`✅ Agent 协作: ${agentsCollaborated ? '成功' : '失败'}`)
  console.log(`   协作步骤: ${chatResult.steps.map(s => s.agent).join(' → ')}`)
  
  // 步骤 5: 验证生成结果
  console.log('\n--- 步骤 5: 验证生成结果 ---')
  const resultsValid = chatResult.state.prd &&
                       chatResult.state.architecture &&
                       chatResult.state.code &&
                       Object.keys(chatResult.state.code).length > 0
  console.log(`✅ 生成结果: ${resultsValid ? '有效' : '无效'}`)
  console.log(`   PRD 长度: ${chatResult.state.prd?.length || 0} 字符`)
  console.log(`   架构长度: ${chatResult.state.architecture?.length || 0} 字符`)
  console.log(`   代码文件数: ${Object.keys(chatResult.state.code || {}).length}`)
  
  // 总结
  console.log('\n' + '='.repeat(60))
  console.log('📊 集成测试总结')
  console.log('='.repeat(60))
  console.log(`✅ 用户注册: ${userRegistered ? '通过' : '失败'}`)
  console.log(`✅ 用户登录: ${userLoggedIn ? '通过' : '失败'}`)
  console.log(`✅ 消息处理: ${messageProcessed ? '通过' : '失败'}`)
  console.log(`✅ Agent 协作: ${agentsCollaborated ? '通过' : '失败'}`)
  console.log(`✅ 生成结果: ${resultsValid ? '通过' : '失败'}`)
  
  const allPassed = userRegistered && 
                    userLoggedIn && 
                    messageProcessed && 
                    agentsCollaborated && 
                    resultsValid
  
  console.log(`\n${allPassed ? '✅ 所有集成测试通过！' : '❌ 部分集成测试失败'}`)
  
  return {
    userRegistered,
    userLoggedIn,
    messageProcessed,
    agentsCollaborated,
    resultsValid,
    allPassed,
  }
}

// 运行测试
if (require.main === module) {
  testIntegration().catch(console.error)
}

export { testIntegration }
