import { useState, useEffect } from 'react'
import type { Artifact } from '../types'

interface WebPreviewProps {
  artifact: Artifact
}

const generatePreviewHTML = (mainCode: string, allFiles: Record<string, string>) => {
  // 简单处理：只移除 import 和 export，让 Babel 处理 TypeScript
  const processCode = (code: string) => {
    let result = code
    
    // 1. 移除 import 语句（逐行处理更安全）
    result = result.split('\n').filter(line => !line.trim().startsWith('import ')).join('\n')
    
    // 2. 处理 export default
    result = result.replace(/export\s+default\s+function\s+(\w+)/g, 'const App = function $1')
    result = result.replace(/export\s+default\s+/g, 'const App = ')
    result = result.replace(/export\s+/g, '')
    
    return result
  }

  // 简单的 React 预览
  if (mainCode.includes('React') || mainCode.includes('react') || mainCode.includes('JSX') || 
      mainCode.includes('useState') || mainCode.includes('useEffect') || mainCode.includes('export default')) {
    
    const processedCode = processCode(mainCode)
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script crossorigin src="https://cdn.staticfile.org/react/18.2.0/umd/react.development.js"></script>
  <script crossorigin src="https://cdn.staticfile.org/react-dom/18.2.0/umd/react-dom.development.js"></script>
  <script src="https://cdn.staticfile.org/babel-standalone/7.23.5/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    #error-display { color: red; padding: 20px; font-family: monospace; white-space: pre-wrap; }
    ${allFiles['index.css'] || allFiles['App.css'] || allFiles['styles.css'] || ''}
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="error-display"></div>
  <script>
    window.__processedCode = ${JSON.stringify(processedCode)};
    window.onerror = function(msg, url, line, col, error) {
      var errDiv = document.getElementById('error-display');
      errDiv.innerHTML = '<b>Error:</b> ' + msg + '<br><b>Line:</b> ' + line + '<br><br><b>Processed Code (first 1000 chars):</b><br><pre style="background:#f5f5f5;padding:10px;overflow:auto;max-height:300px;font-size:11px;white-space:pre-wrap;word-break:break-all;">' + 
        (window.__processedCode || 'N/A').substring(0, 1000) + '</pre>';
      return true;
    };
  </script>
  <script type="text/babel" data-presets="typescript,react">
    const { useState, useCallback, useEffect, useRef, useMemo, useContext, createContext, Fragment } = React;
    
    ${processedCode}
    
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
  <script>
    setTimeout(() => {
      const root = document.getElementById('root');
      const errorDisplay = document.getElementById('error-display');
      if (root && root.innerHTML === '' && !errorDisplay.innerHTML) {
        errorDisplay.innerHTML = '<b>Warning:</b> App rendered empty.<br><br><b>Processed Code:</b><br><pre style="background:#f5f5f5;padding:10px;overflow:auto;max-height:300px;font-size:11px;">' + 
          (window.__processedCode || 'N/A') + '</pre>';
      }
    }, 3000);
  </script>
</body>
</html>
    `
  }

  // 普通 HTML 预览
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>
    ${allFiles['index.css'] || allFiles['App.css'] || 'body { margin: 0; padding: 20px; }'}
  </style>
</head>
<body>
  ${mainCode}
</body>
</html>
  `
}

export function WebPreview({ artifact }: WebPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [previewMode, setPreviewMode] = useState<string>('')

  useEffect(() => {
    if (artifact.type !== 'code' || !artifact.content) {
      setLoading(false)
      return
    }

    const files = artifact.content
    const fileList = Object.keys(files)
    console.log('[WebPreview] Files:', fileList)

    // 如果有沙盒 URL，优先使用沙盒预览
    if (artifact.sandboxInfo?.websiteUrl) {
      console.log('[WebPreview] Using sandbox URL:', artifact.sandboxInfo.websiteUrl)
      setPreviewUrl(artifact.sandboxInfo.websiteUrl)
      setPreviewMode('sandbox')
      setLoading(false)
      return
    }

    // 本地预览：优先使用 App.tsx/App.jsx（不是 index.html 或 main.tsx！）
    // 查找优先级：App.tsx > src/App.tsx > 其他
    const findAppFile = () => {
      // 直接的 App 文件
      if ('App.tsx' in files) return 'App.tsx'
      if ('App.jsx' in files) return 'App.jsx'
      // src 目录下的 App 文件
      if ('src/App.tsx' in files) return 'src/App.tsx'
      if ('src/App.jsx' in files) return 'src/App.jsx'
      // 查找任意路径下的 App 文件（排除 main.tsx, index.tsx）
      const appFile = fileList.find(f => 
        (f.endsWith('/App.tsx') || f.endsWith('/App.jsx') || f === 'App.tsx' || f === 'App.jsx')
      )
      if (appFile) return appFile
      // 排除入口文件，找其他组件
      const componentFile = fileList.find(f => 
        (f.endsWith('.tsx') || f.endsWith('.jsx')) && 
        !f.includes('main.') && !f.includes('index.') && !f.includes('entry.')
      )
      if (componentFile) return componentFile
      // 最后才用其他文件
      return fileList.find(f => f.endsWith('.tsx') || f.endsWith('.jsx')) || Object.keys(files)[0]
    }
    const mainFilePath = findAppFile()
    
    console.log('[WebPreview] Using file:', mainFilePath)
    console.log('[WebPreview] All files:', fileList)
    
    if (!mainFilePath || !files[mainFilePath]) {
      console.log('[WebPreview] No valid file found')
      setLoading(false)
      return
    }

    const mainCode = files[mainFilePath]
    console.log('[WebPreview] Code length:', mainCode.length)
    
    // 检测是否是多文件项目（有多个组件文件）
    const componentFiles = fileList.filter(f => 
      (f.endsWith('.tsx') || f.endsWith('.jsx')) && 
      !f.includes('main.') && !f.includes('index.')
    )
    const isMultiFileProject = componentFiles.length > 1 || 
      mainCode.includes("from './") || mainCode.includes('from "./')
    
    if (isMultiFileProject) {
      console.log('[WebPreview] Multi-file project detected, components:', componentFiles)
    }
    
    try {
      const html = generatePreviewHTML(mainCode, files)
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setPreviewMode('local')
      setLoading(false)

      return () => {
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('[WebPreview] Error:', err)
      setLoading(false)
    }
  }, [artifact])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-500">加载预览中...</p>
        </div>
      </div>
    )
  }

  if (!previewUrl) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 text-gray-500">
        <div className="text-center">
          <p className="mb-2">暂无预览</p>
          <p className="text-sm">代码生成后将显示预览</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-white flex flex-col">
      <div className="flex-shrink-0 px-2 py-1 bg-gray-100 border-b text-xs text-gray-600 flex items-center justify-between">
        <span>
          模式: {previewMode === 'sandbox' ? '🌐 沙盒' : '⚡ 本地'}
        </span>
        {previewMode === 'sandbox' && (
          <a 
            href={previewUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            新窗口打开 ↗
          </a>
        )}
      </div>
      <iframe
        src={previewUrl}
        className="flex-1 w-full border-0"
        title="Web Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  )
}
