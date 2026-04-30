# 🔗 题链扣 · Chaincue

> 懂你的雅思口语串题搭子 —— 用你的真实经历，一个故事串起全季题库

**题链扣** 是一款专为雅思口语 Part 2 准备的 AI 辅助工具。你只需选择本题库中的若干话题，写下自己的真实经历，AI 就会自动分析、分组，并生成一个 **共用主体段 + 每道题定制开头/结尾** 的完整口语稿。一个核心故事，串起多个题目，极大减轻记忆负担。

---

## ✨ 核心功能

- ✅ **真实经历驱动**：不背范文，用你自己的故事作答
- ✅ **智能分组串题**：AI 自动将你的经历分成 1~3 个故事组，每组串起 2~5 道最贴合的话题
- ✅ **共享主体 + 定制头尾**：每组生成一个共用主体段 + 每道题的独立开头/强化段/结尾，背得少，考场灵活切换
- ✅ **全口语化生成**：自然停顿、缩写、填充词，像真人聊天一样
- ✅ **题库自定义**：支持导入 `.txt` 题库，灵活扩充
- ✅ **朗读 & 复制**：一键朗读英文稿，一键复制全稿
- ✅ **历史存档**：自动保存每次生成记录，随时翻看以前的故事
- ✅ **星星自评**：为每道题稿子难度打分，重点复盘

---

## 🚀 在线体验

部署完成后访问：  
👉 [题链扣在线版](https://chaincue-ielts.vercel.app)

> 你也可以本地 clone 并配置自己的 API Key 运行。

---

## 🛠 技术栈

- **前端**：HTML5 + Tailwind CSS + 原生 JavaScript
- **后端**：Vercel Serverless Functions (Node.js)
- **数据库 & 认证**：Supabase (PostgreSQL + Auth)
- **AI 调用**：uiuiAPI (OpenAI‑兼容，模型 `gpt-4o-mini`)

---

## 📦 本地开发 & 部署

### 1. 克隆仓库

```bash
git clone https://github.com/LixinY-code/Chaincue-Ielts.git
cd Chaincue-Ielts
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local`，填入你的密钥：

```env
UIUI_API_KEY=你的uiuiAPIkey
SUPABASE_URL=你的Supabase项目URL
SUPABASE_SERVICE_ROLE_KEY=你的Supabase service_role密钥
```

### 3. 初始化数据库

在 Supabase SQL Editor 中执行 `supabase/migrations/01_init.sql`。

### 4. 本地运行

```bash
vercel dev
```

访问 `http://localhost:3000` 即可预览。

### 5. 部署到 Vercel

1. 将代码推送到 GitHub 仓库
2. 登录 Vercel，导入该仓库
3. 在环境变量页面添加上述三个变量
4. 点击 Deploy，等待完成

---

## 📥 导入自定义题库

支持导入 `.txt` 文本文件，每行格式为：

```text
中文题目名 / 英文题目描述
```

例如：

```text
迷路 / Describe an occasion when you lost your way
```

点击题库区域的「📥 导入题库」按钮，选择文件即可追加（自动去重）。

---

## 🎯 使用流程

1. **登录**：邮箱注册/登录
2. **勾选题目**：选择你想串的 Part 2 话题
3. **输入经历**：写下真实发生的故事（越具体越好）
4. **点击「开始串题」**：AI 后台自动分组并生成脚本
5. **学习脚本**：
   - 先背 **共享主体段**（所有题目共用）
   - 再背每道题的 **开头 + 强化段 + 结尾**
   - 针对不同题目切换开头/结尾即可
6. **收藏与回顾**：点击「收藏」按钮保存优质稿子，到「我的存档」复习

---

## 📄 许可证

本项目仅供个人学习、备考使用。禁止任何形式的二次销售或嵌入商业平台。  
如需商业合作，请联系作者。

---

## 🙋 反馈与支持

- 提交 Issue：[GitHub Issues](https://github.com/LixinY-code/Chaincue-Ielts/issues)

---

## 💡 致谢

- 灵感来源于雅思备考中「串题」的真实痛点
- 题库参考 2026 年 5-8 月雅思口语 Part 2 高频话题

> 用你的故事，说你的答案。—— 题链扣
