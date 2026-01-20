import { useState, useEffect } from 'react'
import type { Artifact } from '../types'

interface WebPreviewProps {
  artifact: Artifact
}

const generatePreviewHTML = (mainCode: string, allFiles: Record<string, string>) => {
  // 简单的 React 预览
  if (mainCode.includes('React') || mainCode.includes('react') || mainCode.includes('JSX')) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    ${allFiles['index.css'] || allFiles['App.css'] || ''}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useCallback, useEffect } = React;
    ${mainCode
      .replace(/export default/g, 'const App =')
      .replace(/export /g, '')
      // 移除所有 import 语句（包括 CSS import）
      .replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '')
      .replace(/import\s+['"].*?['"];?\s*/g, '')
      // 移除 TypeScript 接口定义
      .replace(/interface\s+\w+\s*\{[^}]*\}\s*/g, '')
      .replace(/type\s+\w+\s*=\s*.*?;\s*/g, '')
      // 移除 TypeScript 类型注解
      .replace(/:\s*React\.FC\s*(<[^>]*>)?/g, '')
      .replace(/:\s*React\.ComponentType\s*(<[^>]*>)?/g, '')
      .replace(/:\s*React\.Component\s*(<[^>]*>)?/g, '')
      .replace(/:\s*React\.FC/g, '')
      .replace(/:\s*React\.ComponentType/g, '')
      .replace(/:\s*React\.Component/g, '')
      // 移除泛型类型参数（如 useState<number | null>）
      .replace(/useState\s*<[^>]+>/g, 'useState')
      .replace(/useCallback\s*<[^>]+>/g, 'useCallback')
      .replace(/useEffect\s*<[^>]+>/g, 'useEffect')
      // 移除函数参数和返回值的类型注解
      .replace(/:\s*number\s*\|\s*null/g, '')
      .replace(/:\s*string\s*\|\s*null/g, '')
      .replace(/:\s*boolean\s*\|\s*null/g, '')
      .replace(/:\s*number\s*\|\s*string/g, '')
      .replace(/:\s*number/g, '')
      .replace(/:\s*string/g, '')
      .replace(/:\s*boolean/g, '')
      .replace(/:\s*void/g, '')
      .replace(/:\s*any/g, '')
      // 移除其他泛型
      .replace(/<number\s*\|\s*null>/g, '')
      .replace(/<string\s*\|\s*null>/g, '')
      .replace(/<boolean\s*\|\s*null>/g, '')
      .replace(/<number>/g, '')
      .replace(/<string>/g, '')
      .replace(/<boolean>/g, '')
      // 移除重复的 App 定义（如 const App = App;）
      .replace(/const\s+App\s*=\s*App\s*;/g, '')
      .replace(/let\s+App\s*=\s*App\s*;/g, '')
      .replace(/var\s+App\s*=\s*App\s*;/g, '')
    }
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
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

  useEffect(() => {
    if (artifact.type !== 'code' || !artifact.content) {
      setLoading(false)
      return
    }

    // 如果有沙盒 URL，优先使用沙盒预览
    if (artifact.sandboxInfo?.websiteUrl) {
      setPreviewUrl(artifact.sandboxInfo.websiteUrl)
      setLoading(false)
      return
    }

    // 否则使用浏览器预览
    // 找到主文件（通常是 index.html, App.tsx, 或第一个文件）
    const files = artifact.content
    const mainFilePath = 'index.html' in files 
      ? 'index.html' 
      : 'App.tsx' in files 
      ? 'App.tsx' 
      : 'App.jsx' in files 
      ? 'App.jsx' 
      : Object.keys(files)[0]
    
    if (!mainFilePath) {
      setLoading(false)
      return
    }

    const mainCode = files[mainFilePath] || ''
    const html = generatePreviewHTML(mainCode, files)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    setPreviewUrl(url)
    setLoading(false)

    return () => {
      URL.revokeObjectURL(url)
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
    <div className="h-full bg-white">
      <iframe
        src={previewUrl}
        className="w-full h-full border-0"
        title="Web Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  )
}
