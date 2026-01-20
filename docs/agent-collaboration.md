# Agent 协作机制说明

## 当前架构

### 1. 状态共享机制 (State Sharing)

所有 Agent 通过共享的 `ProjectState` 对象进行信息沟通：

```typescript
interface ProjectState {
  userMessage: string           // 用户原始需求
  currentStatus: 'planning' | 'designing' | 'coding' | 'deploying' | 'complete'
  prd?: string                  // Emma 的输出
  architecture?: string         // Bob 的输出
  code?: Record<string, string> // Alex 的输出
  nextAgent?: 'emma' | 'bob' | 'alex' | 'complete'  // Mike 的决策
}
```

**信息传递方式**：
- ✅ **共享状态对象**：所有 agent 读取和写入同一个 state
- ✅ **上下文传递**：每个 agent 可以看到之前 agent 的输出
  - Bob 可以看到 Emma 的 PRD
  - Alex 可以看到 Emma 的 PRD 和 Bob 的架构设计

### 2. 决策机制 (Decision Making)

**Mike (Supervisor) 的决策流程**：

```
1. 接收当前状态
   ↓
2. 检查已完成工作：
   - PRD: ✅/❌
   - 架构设计: ✅/❌
   - 代码生成: ✅/❌
   ↓
3. 调用 LLM 判断下一步：
   - 如果缺少 PRD → 返回 "emma"
   - 如果缺少架构 → 返回 "bob"
   - 如果缺少代码 → 返回 "alex"
   - 如果都完成 → 返回 "complete"
   ↓
4. 更新 state.nextAgent
```

**决策 Prompt 示例**：
```
你是 Atoms 团队的 Team Leader Mike。

用户需求: 做一个待办事项应用
当前状态: planning
已完成工作: 
- PRD: ❌
- 架构设计: ❌
- 代码生成: ❌

请决定下一步行动:
1. 如果需要 PRD,返回 "emma"
2. 如果需要架构设计,返回 "bob"
3. 如果需要编码,返回 "alex"
4. 如果已完成,返回 "complete"

只返回智能体名称,不要额外解释。
```

### 3. 完成判断机制 (Completion Detection)

**完成条件**：
```typescript
// 方式1: 检查所有必需字段
if (state.prd && state.architecture && state.code) {
  // 项目完成
}

// 方式2: 检查状态
if (state.currentStatus === 'complete') {
  // 项目完成
}

// 方式3: Supervisor 返回 "complete"
if (state.nextAgent === 'complete') {
  // 项目完成
}
```

**完成流程**：
1. Alex 生成代码后，设置 `currentStatus = 'complete'`
2. 下次循环时，Supervisor 检查到所有字段都存在
3. Supervisor 返回 `nextAgent = 'complete'`
4. 循环退出，返回最终响应

### 4. Agent 工作流程

**当前实现的工作流**：

```
用户发送消息
  ↓
Mike.invoke() 被调用
  ↓
初始化 state = { userMessage, currentStatus: 'planning' }
  ↓
[循环开始，最多 5 次迭代]
  ↓
1. Supervisor 决策 (supervisorNode)
   - 检查 state 中缺少什么
   - 调用 LLM 决定 nextAgent
   ↓
2. 执行对应 Agent
   - 如果 nextAgent === 'emma' → 调用 emmaPRDNode
   - 如果 nextAgent === 'bob' → 调用 bobArchitectureNode
   - 如果 nextAgent === 'alex' → 调用 alexCodeGenNode
   ↓
3. Agent 更新 state
   - Emma: state.prd = "...", state.currentStatus = 'designing'
   - Bob: state.architecture = "...", state.currentStatus = 'coding'
   - Alex: state.code = {...}, state.currentStatus = 'complete'
   ↓
4. 立即返回响应（当前实现）
   - 每次只返回一个 agent 的响应
   - 前端需要多次调用才能完成整个流程
  ↓
[循环继续或退出]
```

### 5. 信息沟通方式

**Agent 之间的信息传递**：

1. **Emma → Bob**：
   ```typescript
   // Bob 可以看到 Emma 的 PRD
   const prompt = `作为架构师 Bob,为以下项目设计技术架构:
   用户需求: ${state.userMessage}
   PRD: ${state.prd || '暂无'}  // ← Emma 的输出
   `
   ```

2. **Emma + Bob → Alex**：
   ```typescript
   // Alex 可以看到 PRD 和架构设计
   const prompt = `作为工程师 Alex,为以下项目生成代码:
   用户需求: ${state.userMessage}
   PRD: ${state.prd || '暂无'}           // ← Emma 的输出
   架构: ${state.architecture || '暂无'} // ← Bob 的输出
   `
   ```

3. **Mike → 所有 Agent**：
   ```typescript
   // Mike 通过 state 传递用户需求
   state.userMessage  // 所有 agent 都可以访问
   ```

## 当前实现的限制

### ⚠️ 问题 1: 同步执行，单次返回
- **现状**：每次 `invoke()` 只返回一个 agent 的响应
- **影响**：前端需要多次调用才能看到完整流程
- **理想**：应该支持流式响应，实时返回每个 agent 的工作进度

### ⚠️ 问题 2: 状态不持久化
- **现状**：state 只在内存中，每次调用重新初始化
- **影响**：无法支持多轮对话和状态恢复
- **理想**：应该将 state 保存到数据库

### ⚠️ 问题 3: 没有真正的并行协作
- **现状**：严格按顺序执行（Emma → Bob → Alex）
- **影响**：无法支持需要并行工作的场景
- **理想**：某些 agent 可以并行工作

## 改进建议

### 1. 流式响应
```typescript
// 使用 async generator
async function* invokeStream(state: ProjectState) {
  while (!isComplete(state)) {
    const nextAgent = await supervisorNode(state)
    yield { type: 'agent_start', agent: nextAgent }
    
    const result = await executeAgent(nextAgent, state)
    yield { type: 'agent_complete', agent: nextAgent, result }
    
    updateState(state, result)
  }
}
```

### 2. 状态持久化
```typescript
// 保存到数据库
await supabase.from('project_states').upsert({
  project_id: projectId,
  state: JSON.stringify(state),
  updated_at: new Date()
})
```

### 3. 支持并行执行
```typescript
// 某些 agent 可以并行
if (state.nextAgent === 'parallel') {
  const [prd, architecture] = await Promise.all([
    emmaPRDNode(state),
    bobArchitectureNode(state) // 不依赖 PRD
  ])
}
```
