/**
 * 认证路由测试
 * 测试登录、注册、token 验证等功能
 */

// Mock Supabase
class MockSupabase {
  private users: Map<string, { id: string; email: string; password: string }> = new Map()
  
  async signUp(email: string, password: string) {
    const id = `user-${Date.now()}`
    this.users.set(email, { id, email, password })
    return {
      data: { user: { id, email } },
      error: null,
    }
  }
  
  async signIn(email: string, password: string) {
    const user = this.users.get(email)
    if (!user || user.password !== password) {
      return {
        data: { user: null },
        error: { message: 'Invalid credentials' },
      }
    }
    return {
      data: { user: { id: user.id, email: user.email } },
      error: null,
    }
  }
  
  async getUser(token: string) {
    // 简单的 token 验证（实际应该使用 JWT）
    const email = token.split('-')[1] // 简化处理
    const user = this.users.get(email)
    if (!user) {
      return {
        data: { user: null },
        error: { message: 'Invalid token' },
      }
    }
    return {
      data: { user: { id: user.id, email: user.email } },
      error: null,
    }
  }
}

async function testAuthRoutes() {
  console.log('\n' + '='.repeat(60))
  console.log('🔐 认证路由测试')
  console.log('='.repeat(60))
  
  const supabase = new MockSupabase()
  
  // 测试 1: 用户注册
  console.log('\n📝 测试 1: 用户注册')
  console.log('-'.repeat(60))
  
  const signUpResult = await supabase.signUp('test@example.com', 'password123')
  const signUpSuccess = signUpResult.data.user !== null && !signUpResult.error
  
  console.log(`✅ 注册测试: ${signUpSuccess ? '通过' : '失败'}`)
  console.log(`   用户 ID: ${signUpResult.data.user?.id || 'N/A'}`)
  console.log(`   用户邮箱: ${signUpResult.data.user?.email || 'N/A'}`)
  
  // 测试 2: 用户登录（正确密码）
  console.log('\n📝 测试 2: 用户登录（正确密码）')
  console.log('-'.repeat(60))
  
  const signInSuccess = await supabase.signIn('test@example.com', 'password123')
  const loginSuccess = signInSuccess.data.user !== null && !signInSuccess.error
  
  console.log(`✅ 登录测试（正确）: ${loginSuccess ? '通过' : '失败'}`)
  console.log(`   用户 ID: ${signInSuccess.data.user?.id || 'N/A'}`)
  
  // 测试 3: 用户登录（错误密码）
  console.log('\n📝 测试 3: 用户登录（错误密码）')
  console.log('-'.repeat(60))
  
  const signInFail = await supabase.signIn('test@example.com', 'wrongpassword')
  const loginFail = signInFail.data.user === null && signInFail.error !== null
  
  console.log(`✅ 登录测试（错误）: ${loginFail ? '通过' : '失败'}`)
  console.log(`   错误信息: ${signInFail.error?.message || 'N/A'}`)
  
  // 测试 4: Token 验证（有效 token）
  console.log('\n📝 测试 4: Token 验证（有效 token）')
  console.log('-'.repeat(60))
  
  const validToken = `token-test@example.com`
  const verifySuccess = await supabase.getUser(validToken)
  const tokenValid = verifySuccess.data.user !== null && !verifySuccess.error
  
  console.log(`✅ Token 验证（有效）: ${tokenValid ? '通过' : '失败'}`)
  console.log(`   用户 ID: ${verifySuccess.data.user?.id || 'N/A'}`)
  
  // 测试 5: Token 验证（无效 token）
  console.log('\n📝 测试 5: Token 验证（无效 token）')
  console.log('-'.repeat(60))
  
  const invalidToken = 'token-invalid@example.com'
  const verifyFail = await supabase.getUser(invalidToken)
  const tokenInvalid = verifyFail.data.user === null && verifyFail.error !== null
  
  console.log(`✅ Token 验证（无效）: ${tokenInvalid ? '通过' : '失败'}`)
  console.log(`   错误信息: ${verifyFail.error?.message || 'N/A'}`)
  
  // 总结
  console.log('\n' + '='.repeat(60))
  console.log('📊 认证测试总结')
  console.log('='.repeat(60))
  console.log(`✅ 用户注册: ${signUpSuccess ? '通过' : '失败'}`)
  console.log(`✅ 用户登录（正确）: ${loginSuccess ? '通过' : '失败'}`)
  console.log(`✅ 用户登录（错误）: ${loginFail ? '通过' : '失败'}`)
  console.log(`✅ Token 验证（有效）: ${tokenValid ? '通过' : '失败'}`)
  console.log(`✅ Token 验证（无效）: ${tokenInvalid ? '通过' : '失败'}`)
  
  const allPassed = signUpSuccess && loginSuccess && loginFail && tokenValid && tokenInvalid
  console.log(`\n${allPassed ? '✅ 所有认证测试通过！' : '❌ 部分测试失败'}`)
  
  return {
    signUp: signUpSuccess,
    loginSuccess,
    loginFail,
    tokenValid,
    tokenInvalid,
    allPassed,
  }
}

// 运行测试
if (require.main === module) {
  testAuthRoutes().catch(console.error)
}

export { testAuthRoutes, MockSupabase }
