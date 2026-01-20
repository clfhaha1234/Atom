# Supabase 邮箱确认配置

## 问题
Supabase 默认要求用户注册后必须确认邮箱才能登录。这会导致 "Email not confirmed" 错误。

## 解决方案

### 方案 1: 在 Supabase Dashboard 中禁用邮箱确认（推荐用于开发）

1. 登录 Supabase Dashboard: https://supabase.com/dashboard
2. 选择你的项目
3. 进入 **Authentication** > **Settings**
4. 找到 **Email Auth** 部分
5. 取消勾选 **"Enable email confirmations"**
6. 保存设置

这样新注册的用户就可以直接登录，无需确认邮箱。

### 方案 2: 手动确认用户邮箱（用于测试）

在 Supabase Dashboard 中：
1. 进入 **Authentication** > **Users**
2. 找到你的用户
3. 点击用户，然后点击 **"Confirm email"** 按钮

### 方案 3: 使用代码中的重新发送确认邮件功能

登录页面现在提供了"重新发送确认邮件"按钮，点击后会发送新的确认邮件到你的邮箱。

## 当前实现

代码已经更新，现在会：
1. 检测邮箱未确认错误
2. 显示友好的错误提示
3. 提供"重新发送确认邮件"按钮
4. 注册时设置重定向 URL

## 生产环境建议

在生产环境中，建议：
1. 保持邮箱确认功能开启（安全性）
2. 配置邮件服务（SMTP）
3. 使用自定义邮件模板
4. 设置邮件重定向 URL
