#!/usr/bin/env python3
"""
Daytona 沙盒服务 Python 脚本
从 Node.js/TypeScript 调用此脚本来管理 Daytona 沙盒
"""

import json
import sys
import os
from typing import Dict, Any, Optional

# 修复 macOS SSL 证书问题
try:
    import certifi
    import ssl
    # 设置 SSL 证书路径
    os.environ['SSL_CERT_FILE'] = certifi.where()
    os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()
    # 配置默认 SSL 上下文
    ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi.where())
except ImportError:
    pass  # certifi 未安装，使用系统默认证书

try:
    from daytona import (
        CreateSandboxFromImageParams,
        Daytona,
        DaytonaConfig,
        Resources,
        SandboxState,
        SessionExecuteRequest,
    )
except ImportError:
    print(json.dumps({
        "error": "daytona package not installed. Run: pip install daytona==0.21.8 structlog==25.4.0"
    }), file=sys.stderr)
    sys.exit(1)


def get_daytona_client() -> Daytona:
    """初始化 Daytona 客户端"""
    api_key = os.getenv('DAYTONA_API_KEY')
    server_url = os.getenv('DAYTONA_SERVER_URL', 'https://app.daytona.io/api')
    target = os.getenv('DAYTONA_TARGET', 'us')
    
    if not api_key:
        raise ValueError("DAYTONA_API_KEY environment variable is required")
    
    # 根据 OpenManus 和官方文档的配置方式
    # 直接传递参数，不使用字典
    try:
        config = DaytonaConfig(
            api_key=api_key,
            server_url=server_url,
            target=target,
        )
    except TypeError as e:
        # 如果参数不匹配，尝试只传 api_key
        print(f"Warning: Failed to create config with all params: {e}", file=sys.stderr)
        try:
            config = DaytonaConfig(api_key=api_key, server_url=server_url)
        except TypeError:
            config = DaytonaConfig(api_key=api_key)
    
    return Daytona(config)


def create_sandbox(password: str = "123456", project_id: Optional[str] = None) -> Dict[str, Any]:
    """创建新的 Daytona 沙盒"""
    try:
        daytona = get_daytona_client()
        sandbox_image = os.getenv('DAYTONA_SANDBOX_IMAGE', 'whitezxj/sandbox:0.1.0')
        
        # 根据文档，使用 CreateSandboxFromImageParams 创建沙盒
        labels = None
        if project_id:
            labels = {"id": project_id}
        
        params = CreateSandboxFromImageParams(
            image=sandbox_image,
            public=True,
            labels=labels,
            env_vars={
                "CHROME_PERSISTENT_SESSION": "true",
                "RESOLUTION": "1024x768x24",
                "RESOLUTION_WIDTH": "1024",
                "RESOLUTION_HEIGHT": "768",
                "VNC_PASSWORD": password,
                "ANONYMIZED_TELEMETRY": "false",
                "CHROME_PATH": "",
                "CHROME_USER_DATA": "",
                "CHROME_DEBUGGING_PORT": "9222",
                "CHROME_DEBUGGING_HOST": "localhost",
                "CHROME_CDP": "",
            },
            resources=Resources(
                cpu=2,
                memory=4,
                disk=5,
            ),
            auto_stop_interval=15,
            auto_archive_interval=24 * 60,
        )
        
        # 使用 daytona.create() 创建沙盒
        sandbox = daytona.create(params)
        
        # 启动 supervisord（如果需要）
        try:
            session_id = "supervisord-session"
            sandbox.process.create_session(session_id)
            sandbox.process.execute_session_command(
                session_id,
                SessionExecuteRequest(
                    command="exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/supervisord.conf",
                    var_async=True,
                ),
            )
        except Exception as e:
            # supervisord 启动失败不影响沙盒创建
            pass
        
        # 获取预览链接
        try:
            vnc_link = sandbox.get_preview_link(6080)
            website_link = sandbox.get_preview_link(8080)
            
            vnc_url = vnc_link.url if hasattr(vnc_link, "url") else str(vnc_link)
            website_url = website_link.url if hasattr(website_link, "url") else str(website_link)
        except Exception as e:
            # 如果获取预览链接失败，使用默认值
            vnc_url = f"https://6080-{sandbox.id}.daytona.work"
            website_url = f"https://8080-{sandbox.id}.daytona.work"
        
        return {
            "success": True,
            "sandbox_id": sandbox.id,
            "vnc_url": vnc_url,
            "website_url": website_url,
        }
    except Exception as e:
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        return {
            "success": False,
            "error": error_msg,
        }


def write_file(sandbox_id: str, file_path: str, content: str) -> Dict[str, Any]:
    """在沙盒中写入文件"""
    try:
        daytona = get_daytona_client()
        sandbox = daytona.get(sandbox_id)
        
        # 确保沙盒运行中
        if sandbox.state == SandboxState.ARCHIVED or sandbox.state == SandboxState.STOPPED:
            daytona.start(sandbox)
            sandbox = daytona.get(sandbox_id)
        
        # 清理路径
        file_path = file_path.lstrip('/')
        full_path = f"/workspace/{file_path}"
        
        # 使用文件系统 API 上传文件
        sandbox.fs.upload_file(content.encode('utf-8'), full_path)
        
        return {
            "success": True,
            "message": f"File {file_path} written successfully",
        }
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": f"{str(e)}\n{traceback.format_exc()}",
        }


def run_command(sandbox_id: str, command: str, blocking: bool = False, timeout: int = 60) -> Dict[str, Any]:
    """在沙盒中执行命令"""
    try:
        daytona = get_daytona_client()
        sandbox = daytona.get(sandbox_id)
        
        # 确保沙盒运行中
        if sandbox.state == SandboxState.ARCHIVED or sandbox.state == SandboxState.STOPPED:
            daytona.start(sandbox)
            sandbox = daytona.get(sandbox_id)
        
        # 使用 session 执行命令（shell 命令）
        # 如果命令不是以 sh -c 开头，自动包装
        if not command.startswith('sh -c') and not command.startswith('/bin/sh'):
            command = f"sh -c '{command.replace(chr(39), chr(39)+chr(39)+chr(39))}'"
        
        session_id = f"cmd-{sandbox_id[:8]}"
        try:
            sandbox.process.create_session(session_id)
        except:
            pass  # Session might already exist
        
        req = SessionExecuteRequest(
            command=command,
            run_async=not blocking,
            cwd="/workspace",
        )
        
        response = sandbox.process.execute_session_command(
            session_id=session_id,
            req=req,
            timeout=timeout,
        )
        
        if blocking:
            # 等待命令完成并获取日志
            import time
            max_wait = timeout
            waited = 0
            while waited < max_wait:
                try:
                    logs = sandbox.process.get_session_command_logs(
                        session_id=session_id,
                        command_id=response.cmd_id,
                    )
                    # 检查命令是否完成（通过检查 exit_code 或日志）
                    if response.exit_code is not None or (logs and len(logs) > 0):
                        return {
                            "success": True,
                            "output": logs or "",
                            "exit_code": response.exit_code or 0,
                        }
                except:
                    pass
                time.sleep(1)
                waited += 1
            
            # 超时后返回当前日志
            try:
                logs = sandbox.process.get_session_command_logs(
                    session_id=session_id,
                    command_id=response.cmd_id,
                )
                return {
                    "success": True,
                    "output": logs or "",
                    "exit_code": response.exit_code or 0,
                }
            except:
                return {
                    "success": True,
                    "output": "",
                    "exit_code": response.exit_code or 0,
                }
        else:
            return {
                "success": True,
                "command_id": response.cmd_id,
                "session_id": session_id,
                "message": "Command started (non-blocking)",
            }
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": f"{str(e)}\n{traceback.format_exc()}",
        }


def delete_sandbox(sandbox_id: str) -> Dict[str, Any]:
    """删除沙盒"""
    try:
        daytona = get_daytona_client()
        sandbox = daytona.get(sandbox_id)
        # 根据文档，使用 sandbox.delete()
        sandbox.delete()
        return {
            "success": True,
            "message": f"Sandbox {sandbox_id} deleted",
        }
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": f"{str(e)}\n{traceback.format_exc()}",
        }


def main():
    """主函数：处理命令行参数"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Usage: python daytona_sandbox.py <action> [args...]"
        }), file=sys.stderr)
        sys.exit(1)
    
    action = sys.argv[1]
    
    try:
        if action == "create":
            password = sys.argv[2] if len(sys.argv) > 2 else "123456"
            project_id = sys.argv[3] if len(sys.argv) > 3 else None
            result = create_sandbox(password, project_id)
            print(json.dumps(result))
        
        elif action == "write_file":
            if len(sys.argv) < 5:
                print(json.dumps({
                    "error": "Usage: write_file <sandbox_id> <file_path> <content>"
                }), file=sys.stderr)
                sys.exit(1)
            sandbox_id = sys.argv[2]
            file_path = sys.argv[3]
            content = sys.argv[4]
            result = write_file(sandbox_id, file_path, content)
            print(json.dumps(result))
        
        elif action == "run_command":
            if len(sys.argv) < 4:
                print(json.dumps({
                    "error": "Usage: run_command <sandbox_id> <command> [blocking] [timeout]"
                }), file=sys.stderr)
                sys.exit(1)
            sandbox_id = sys.argv[2]
            command = sys.argv[3]
            blocking = sys.argv[4].lower() == "true" if len(sys.argv) > 4 else False
            timeout = int(sys.argv[5]) if len(sys.argv) > 5 else 60
            result = run_command(sandbox_id, command, blocking, timeout)
            print(json.dumps(result))
        
        elif action == "delete":
            if len(sys.argv) < 3:
                print(json.dumps({
                    "error": "Usage: delete <sandbox_id>"
                }), file=sys.stderr)
                sys.exit(1)
            sandbox_id = sys.argv[2]
            result = delete_sandbox(sandbox_id)
            print(json.dumps(result))
        
        else:
            print(json.dumps({
                "error": f"Unknown action: {action}"
            }), file=sys.stderr)
            sys.exit(1)
    
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
        }), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
