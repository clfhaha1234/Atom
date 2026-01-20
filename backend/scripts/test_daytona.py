#!/usr/bin/env python3
"""
Daytona 沙盒 Python 脚本测试
直接测试 Python 脚本的功能
"""

import os
import sys
import json
import time

# 添加脚本目录到路径
sys.path.insert(0, os.path.dirname(__file__))

from daytona_sandbox import (
    create_sandbox,
    write_file,
    run_command,
    delete_sandbox,
    get_daytona_client,
)

def test_create_sandbox():
    """测试创建沙盒"""
    print("🧪 测试 1: 创建沙盒...")
    
    try:
        result = create_sandbox(password="test123", project_id="test-project")
        
        if not result.get("success"):
            print(f"❌ 创建沙盒失败: {result.get('error')}")
            return None
        
        sandbox_id = result.get("sandbox_id")
        vnc_url = result.get("vnc_url")
        website_url = result.get("website_url")
        
        print(f"✅ 沙盒创建成功!")
        print(f"   Sandbox ID: {sandbox_id}")
        print(f"   VNC URL: {vnc_url}")
        print(f"   Website URL: {website_url}")
        
        return sandbox_id
    except Exception as e:
        print(f"❌ 创建沙盒异常: {e}")
        return None


def test_write_file(sandbox_id: str):
    """测试写入文件"""
    print("\n🧪 测试 2: 写入文件...")
    
    try:
        test_content = "Hello from test!\nThis is a test file."
        result = write_file(sandbox_id, "test-file.txt", test_content)
        
        if not result.get("success"):
            print(f"❌ 写入文件失败: {result.get('error')}")
            return False
        
        print(f"✅ 文件写入成功: {result.get('message')}")
        return True
    except Exception as e:
        print(f"❌ 写入文件异常: {e}")
        return False


def test_run_command(sandbox_id: str):
    """测试执行命令"""
    print("\n🧪 测试 3: 执行命令...")
    
    try:
        # 测试阻塞命令
        print("   执行阻塞命令: ls -la /workspace")
        result = run_command(sandbox_id, "ls -la /workspace", blocking=True, timeout=30)
        
        if not result.get("success"):
            print(f"❌ 执行命令失败: {result.get('error')}")
            return False
        
        output = result.get("output", "")
        print(f"✅ 命令执行成功!")
        print(f"   输出: {output[:200]}...")  # 只显示前200字符
        
        # 验证文件是否存在
        if "test-file.txt" in output:
            print("✅ 验证: 文件已成功写入")
        else:
            print("⚠️  警告: 未找到测试文件")
        
        return True
    except Exception as e:
        print(f"❌ 执行命令异常: {e}")
        return False


def test_read_file(sandbox_id: str):
    """测试读取文件（通过命令）"""
    print("\n🧪 测试 4: 读取文件...")
    
    try:
        result = run_command(sandbox_id, "cat /workspace/test-file.txt", blocking=True, timeout=10)
        
        if not result.get("success"):
            print(f"❌ 读取文件失败: {result.get('error')}")
            return False
        
        output = result.get("output", "")
        if "Hello from test!" in output:
            print("✅ 文件读取成功，内容正确!")
            print(f"   内容: {output[:100]}...")
            return True
        else:
            print(f"⚠️  文件内容不匹配: {output}")
            return False
    except Exception as e:
        print(f"❌ 读取文件异常: {e}")
        return False


def test_delete_sandbox(sandbox_id: str):
    """测试删除沙盒"""
    print("\n🧪 测试 5: 删除沙盒...")
    
    try:
        result = delete_sandbox(sandbox_id)
        
        if not result.get("success"):
            print(f"❌ 删除沙盒失败: {result.get('error')}")
            return False
        
        print(f"✅ 沙盒删除成功: {result.get('message')}")
        return True
    except Exception as e:
        print(f"❌ 删除沙盒异常: {e}")
        return False


def main():
    """主测试函数"""
    print("=" * 60)
    print("Daytona 沙盒功能测试")
    print("=" * 60)
    
    # 检查环境变量
    if not os.getenv("DAYTONA_API_KEY"):
        print("❌ 错误: DAYTONA_API_KEY 环境变量未设置")
        print("   请设置环境变量: export DAYTONA_API_KEY=your_key")
        sys.exit(1)
    
    print(f"✅ API Key 已配置")
    print(f"   Server URL: {os.getenv('DAYTONA_SERVER_URL', 'https://app.daytona.io/api')}")
    print(f"   Target: {os.getenv('DAYTONA_TARGET', 'us')}")
    print()
    
    sandbox_id = None
    tests_passed = 0
    tests_total = 5
    
    try:
        # 测试 1: 创建沙盒
        sandbox_id = test_create_sandbox()
        if sandbox_id:
            tests_passed += 1
            time.sleep(5)  # 等待沙盒完全启动
        else:
            print("\n❌ 无法继续测试，因为沙盒创建失败")
            sys.exit(1)
        
        # 测试 2: 写入文件
        if test_write_file(sandbox_id):
            tests_passed += 1
            time.sleep(2)
        
        # 测试 3: 执行命令
        if test_run_command(sandbox_id):
            tests_passed += 1
        
        # 测试 4: 读取文件
        if test_read_file(sandbox_id):
            tests_passed += 1
        
        # 测试 5: 删除沙盒
        if test_delete_sandbox(sandbox_id):
            tests_passed += 1
            sandbox_id = None  # 已删除，不需要清理
    
    except KeyboardInterrupt:
        print("\n\n⚠️  测试被用户中断")
    except Exception as e:
        print(f"\n\n❌ 测试过程中发生异常: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # 清理：确保删除沙盒
        if sandbox_id:
            print("\n🧹 清理: 删除测试沙盒...")
            try:
                delete_sandbox(sandbox_id)
                print("✅ 清理完成")
            except Exception as e:
                print(f"⚠️  清理失败: {e}")
    
    # 测试结果
    print("\n" + "=" * 60)
    print(f"测试结果: {tests_passed}/{tests_total} 通过")
    print("=" * 60)
    
    if tests_passed == tests_total:
        print("🎉 所有测试通过!")
        sys.exit(0)
    else:
        print("❌ 部分测试失败")
        sys.exit(1)


if __name__ == "__main__":
    main()
