# 安全策略 / Security Policy

## 设计上的隐私与安全

「拾词」是一个**纯离线**应用：

- APK **不申请任何权限**，包括 `INTERNET`；
- 应用内没有账号、登录、密码、云同步，也不会发起任何网络请求；
- 学习进度只写入本机 `SharedPreferences`（`wordatlas`），卸载即删除；
- 导出/导入使用 Android 系统文件选择器（SAF），文件由用户自行选择位置。

## 不包含在仓库中的内容

- 签名用的 keystore 与密码（`tools/*.keystore` 已被 `.gitignore` 排除）；
- 任何 GitHub token、API key、个人信息。

如果你在仓库历史或发布物中发现上述内容，请立即通过私下渠道告知。

## 报告漏洞

请使用 GitHub 的
[私密漏洞报告](https://github.com/JopeyZhang/Shici/security/advisories/new)
（Security → Report a vulnerability），不要先公开 Issue。

报告中请包含：受影响版本、复现步骤、影响范围、可能的修复建议。
一般会在 7 天内回复。

## 支持范围

仅维护最新 Release 版本。自行构建或修改的版本不在支持范围内。
