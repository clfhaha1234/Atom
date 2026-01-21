#!/usr/bin/env python3
"""
使用 Python 直接连接 Supabase PostgreSQL 数据库并创建表
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ 需要设置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

# 从 URL 提取项目引用
project_ref = SUPABASE_URL.split("//")[1].split(".")[0]
print(f"📋 项目 ID: {project_ref}")

# 尝试导入 psycopg2
try:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError:
    print("❌ 需要安装 psycopg2-binary")
    print("   运行: pip3 install psycopg2-binary python-dotenv")
    sys.exit(1)


def get_db_connection():
    """获取数据库连接"""
    # 尝试从环境变量获取数据库密码或连接字符串
    db_password = os.getenv("SUPABASE_DB_PASSWORD")
    db_connection_string = os.getenv("SUPABASE_DB_CONNECTION_STRING")

    # 如果提供了连接字符串，尝试解析
    if db_connection_string:
        try:
            # 解析连接字符串: postgresql://postgres:password@host:port/dbname
            import urllib.parse

            parsed = urllib.parse.urlparse(db_connection_string)
            db_password = parsed.password or db_password
            db_host = parsed.hostname
            db_port = parsed.port or 5432
            db_name = parsed.path.lstrip("/") or "postgres"
            db_user = parsed.username or "postgres"

            print(f"✅ 从连接字符串解析数据库信息")
            print(f"   主机: {db_host}")
            print(f"   端口: {db_port}")
            print(f"   数据库: {db_name}")

            try:
                conn = psycopg2.connect(
                    host=db_host,
                    port=db_port,
                    database=db_name,
                    user=db_user,
                    password=db_password,
                    sslmode="require",
                )
                conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
                print("✅ 数据库连接成功")
                return conn
            except psycopg2.OperationalError as e:
                print(f"❌ 数据库连接失败: {e}")
                return None
        except Exception as e:
            print(f"⚠️  解析连接字符串失败: {e}")

    # 如果没有密码，提示用户
    if not db_password:
        print("\n⚠️  需要设置数据库密码")
        print("   方法 1: 设置环境变量 SUPABASE_DB_PASSWORD")
        print("   方法 2: 设置环境变量 SUPABASE_DB_CONNECTION_STRING")
        print()
        print("   获取密码的方式:")
        print("   1. 打开 Supabase Dashboard: https://supabase.com/dashboard")
        print("   2. 选择你的项目")
        print("   3. 进入 Settings -> Database")
        print("   4. 在 Connection string 中找到密码")
        print("   5. 或者在 .env 文件中添加:")
        print(f"      SUPABASE_DB_PASSWORD=your_password")
        print("   6. 或者添加完整连接字符串:")
        print(
            f"      SUPABASE_DB_CONNECTION_STRING=postgresql://postgres:[password]@db.{project_ref}.supabase.co:5432/postgres"
        )
        return None

    # 使用环境变量中的密码
    db_host = f"db.{project_ref}.supabase.co"
    db_port = 5432
    db_name = "postgres"
    db_user = "postgres"

    # 构建连接字符串
    db_host = f"db.{project_ref}.supabase.co"
    db_port = 5432
    db_name = "postgres"
    db_user = "postgres"

    try:
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            database=db_name,
            user=db_user,
            password=db_password,
            sslmode="require",
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        print("✅ 数据库连接成功")
        return conn
    except psycopg2.OperationalError as e:
        print(f"❌ 数据库连接失败: {e}")
        print("\n💡 提示:")
        print("   1. 检查密码是否正确")
        print("   2. 检查网络连接")
        print("   3. 确认 Supabase 项目已启用数据库访问")
        return None


def read_sql_file():
    """读取 SQL 文件"""
    script_dir = Path(__file__).parent
    sql_file = script_dir.parent / "docs" / "database-schema.sql"

    if not sql_file.exists():
        print(f"❌ SQL 文件不存在: {sql_file}")
        return None

    with open(sql_file, "r", encoding="utf-8") as f:
        return f.read()


def create_tables():
    """创建数据库表"""
    print("\n🔄 开始创建数据库表...\n")

    # 读取 SQL
    sql = read_sql_file()
    if not sql:
        return False

    # 连接数据库
    conn = get_db_connection()
    if not conn:
        return False

    try:
        cursor = conn.cursor()

        # 使用 psycopg2 的 execute 直接执行整个 SQL 脚本
        # 这是最简单可靠的方法
        try:
            # 直接执行整个 SQL（psycopg2 支持多语句）
            cursor.execute(sql)
            print("  ✅ SQL 执行成功（批量执行）")
            success_count = 1
            error_count = 0
        except psycopg2.Error as e:
            # 如果批量执行失败，尝试逐句执行
            print(f"  ⚠️  批量执行失败，尝试逐句执行: {e}")

            # 简单的分割方法：按分号分割，但保留函数体
            statements = []
            current = ""
            in_dollar = False
            dollar_tag = None

            for line in sql.split("\n"):
                line_stripped = line.strip()

                # 跳过注释
                if line_stripped.startswith("--") and not in_dollar:
                    continue

                # 检查 $$ 引号
                if "$$" in line:
                    parts = line.split("$$")
                    for i, part in enumerate(parts):
                        current += part
                        if i < len(parts) - 1:
                            if not in_dollar:
                                # 开始 $$ 引号
                                in_dollar = True
                                # 检查是否有标签（如 $function$）
                                if i + 1 < len(parts):
                                    next_part = (
                                        parts[i + 1] if i + 1 < len(parts) else ""
                                    )
                                    if next_part and next_part[0].isalnum():
                                        dollar_tag = (
                                            "$$" + next_part.split()[0]
                                            if next_part.split()
                                            else "$$"
                                        )
                                    else:
                                        dollar_tag = "$$"
                                current += "$$"
                            else:
                                # 结束 $$ 引号
                                if dollar_tag and dollar_tag in current:
                                    in_dollar = False
                                    dollar_tag = None
                                current += "$$"
                else:
                    current += line + "\n"

                # 如果不在引号内且遇到分号，分割语句
                if not in_dollar and line.rstrip().endswith(";"):
                    stmt = current.strip()
                    if stmt and not stmt.startswith("--"):
                        statements.append(stmt)
                    current = ""

            # 添加最后一个语句
            if current.strip() and not current.strip().startswith("--"):
                statements.append(current.strip())

            # 逐句执行
            success_count = 0
            error_count = 0

            for i, statement in enumerate(statements, 1):
                if not statement.strip():
                    continue

                try:
                    cursor.execute(statement)
                    # 提取操作类型
                    stmt_upper = statement.upper().strip()
                    if "CREATE TABLE" in stmt_upper:
                        table_match = (
                            stmt_upper.split("CREATE TABLE")[1].split()[0]
                            if "IF NOT EXISTS"
                            not in stmt_upper.split("CREATE TABLE")[1]
                            else stmt_upper.split("IF NOT EXISTS")[1].split()[0]
                        )
                        print(f"  ✅ [{i}] 创建表: {table_match}")
                    elif "CREATE INDEX" in stmt_upper:
                        print(f"  ✅ [{i}] 创建索引")
                    elif (
                        "CREATE FUNCTION" in stmt_upper
                        or "CREATE OR REPLACE FUNCTION" in stmt_upper
                    ):
                        print(f"  ✅ [{i}] 创建函数")
                    elif "CREATE TRIGGER" in stmt_upper:
                        print(f"  ✅ [{i}] 创建触发器")
                    else:
                        print(f"  ✅ [{i}] 执行 SQL 语句")
                    success_count += 1
                except psycopg2.Error as e:
                    # 忽略"已存在"的错误
                    if (
                        "already exists" in str(e).lower()
                        or "duplicate" in str(e).lower()
                    ):
                        print(f"  ⚠️  [{i}] 已存在，跳过")
                    else:
                        print(f"  ❌ [{i}] 执行失败: {e}")
                        error_count += 1

        # 执行每个 SQL 语句
        success_count = 0
        error_count = 0

        for i, statement in enumerate(statements, 1):
            if not statement.strip() or statement.strip().startswith("--"):
                continue

            try:
                cursor.execute(statement)
                # 提取表名或操作类型用于显示
                if "CREATE TABLE" in statement.upper():
                    table_match = statement.upper().split("CREATE TABLE")[1].split()[0]
                    print(f"  ✅ [{i}] 创建表: {table_match}")
                elif "CREATE INDEX" in statement.upper():
                    index_match = statement.upper().split("CREATE INDEX")[1].split()[0]
                    print(f"  ✅ [{i}] 创建索引: {index_match}")
                elif (
                    "CREATE FUNCTION" in statement.upper()
                    or "CREATE OR REPLACE FUNCTION" in statement.upper()
                ):
                    print(f"  ✅ [{i}] 创建函数: update_updated_at_column")
                elif "CREATE TRIGGER" in statement.upper():
                    trigger_match = (
                        statement.upper().split("CREATE TRIGGER")[1].split()[0]
                    )
                    print(f"  ✅ [{i}] 创建触发器: {trigger_match}")
                else:
                    print(f"  ✅ [{i}] 执行 SQL 语句")
                success_count += 1
            except psycopg2.Error as e:
                # 忽略"已存在"的错误
                if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                    print(f"  ⚠️  [{i}] 已存在，跳过")
                else:
                    print(f"  ❌ [{i}] 执行失败: {e}")
                    error_count += 1

        cursor.close()

        print(f"\n📊 执行结果:")
        print(f"   ✅ 成功: {success_count}")
        if error_count > 0:
            print(f"   ❌ 失败: {error_count}")

        return error_count == 0

    except Exception as e:
        print(f"❌ 执行 SQL 时出错: {e}")
        return False
    finally:
        conn.close()


def verify_tables():
    """验证表是否创建成功"""
    print("\n🔍 验证表是否创建成功...\n")

    conn = get_db_connection()
    if not conn:
        return False

    try:
        cursor = conn.cursor()

        tables = ["projects", "project_states", "messages"]
        all_exist = True

        for table_name in tables:
            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = %s
                );
            """,
                (table_name,),
            )

            exists = cursor.fetchone()[0]
            if exists:
                print(f"  ✅ 表 {table_name} 存在")
            else:
                print(f"  ❌ 表 {table_name} 不存在")
                all_exist = False

        cursor.close()
        return all_exist

    except Exception as e:
        print(f"❌ 验证失败: {e}")
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Supabase 数据库表创建工具")
    print("=" * 60)

    # 创建表
    success = create_tables()

    if success:
        # 验证表
        if verify_tables():
            print("\n✅ 所有表创建成功！")
            print("\n🎉 数据库已就绪，可以开始使用了")
            sys.exit(0)
        else:
            print("\n⚠️  表创建完成，但验证时发现问题")
            sys.exit(1)
    else:
        print("\n❌ 表创建失败")
        print("\n💡 如果遇到连接问题，请:")
        print("   1. 检查 SUPABASE_DB_PASSWORD 是否正确")
        print("   2. 在 Supabase Dashboard -> Settings -> Database 获取密码")
        print("   3. 或使用 Supabase Dashboard 的 SQL Editor 手动执行")
        sys.exit(1)
