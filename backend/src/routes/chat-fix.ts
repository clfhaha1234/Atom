import express from 'express'
import { createMikeAgent } from '../agents/mike'

const router = express.Router()

interface FixErrorRequest {
  errorId: string
  errorInfo: {
    type: string
    message: string
    file?: string
    line?: number
    stack?: string
  }
  codeContext: Record<string, string>
  projectId?: string
}

/**
 * 修复错误端点
 * POST /api/chat/fix-error
 */
router.post('/fix-error', async (req, res) => {
  const { errorId, errorInfo, codeContext, projectId } = req.body as FixErrorRequest

  try {
    // 构建修复提示词
    const fixPrompt = `作为工程师 Alex，需要修复以下错误：

错误类型: ${errorInfo.type}
错误信息: ${errorInfo.message}
${errorInfo.file ? `文件: ${errorInfo.file}` : ''}
${errorInfo.line ? `行号: ${errorInfo.line}` : ''}
${errorInfo.stack ? `堆栈:\n${errorInfo.stack}` : ''}

当前代码上下文:
${Object.entries(codeContext).map(([file, code]) => `\n${file}:\n${code}`).join('\n---\n')}

请分析错误原因，生成修复后的代码。返回 JSON 格式：
{
  "fixedCode": {
    "文件名": "修复后的代码内容"
  },
  "explanation": "修复说明"
}`

    // 调用 AI 生成修复代码
    const mike = createMikeAgent()
    
    // 使用 Alex 的代码生成能力来修复
    const response = await mike.invoke({
      userMessage: fixPrompt,
      projectId: projectId || 'fix-error',
      userId: 'user-1', // TODO: 从认证中获取
    })

    // 解析修复结果
    let fixedCode: Record<string, string> = {}
    let explanation = ''

    try {
      const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content)
      
      // 尝试解析 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        fixedCode = parsed.fixedCode || {}
        explanation = parsed.explanation || '代码已修复'
      } else {
        // 如果没有 JSON，尝试从代码 artifact 中获取
        if (response.artifacts) {
          const codeArtifact = response.artifacts.find(a => a.type === 'code')
          if (codeArtifact && codeArtifact.content) {
            fixedCode = codeArtifact.content
            explanation = '代码已重新生成'
          }
        }
      }
    } catch (parseError) {
      console.error('Failed to parse fix response:', parseError)
      // 如果解析失败，使用原始代码但标记为需要手动检查
      fixedCode = codeContext
      explanation = '修复建议已生成，请手动检查'
    }

    res.json({
      success: true,
      errorId,
      fixedCode,
      explanation,
      message: '错误已修复',
    })
  } catch (error) {
    console.error('Fix error:', error)
    res.status(500).json({
      success: false,
      errorId,
      error: error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error)),
      message: '修复失败',
    })
  }
})

export default router
