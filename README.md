# 题链扣 — 懂你的雅思串题搭子

> AI 驱动的雅思口语 Part 2 串题工具，输入真实经历，一键生成多题共享稿。

## 技术架构

```
用户浏览器 (index.html)
    ↕ POST /api/generate  (Supabase JWT 鉴权)
Vercel Serverless Functions (Node.js)
    ↕ OpenAI-compatible API
uiuiAPI (gpt-4o-mini)
    ↕
Supabase (PostgreSQL + Auth)
```

## 从零部署步骤

### 1. 创建 Supabase 项目

1. 访问 [supabase.com](https://supabase.com)，注册/登录
2. 点击 **New Project**，设置项目名称和数据库密码
3. 选择区域（推荐 Singapore 或 Northeast Asia）
4. 等待项目创建完成（约 2 分钟）

### 2. 初始化数据库

1. 进入 Supabase Dashboard → **SQL Editor**
2. 复制 `supabase/migrations/01_init.sql` 的内容
3. 粘贴到 SQL Editor 并点击 **Run**
4. 这会创建 `histories` 和 `archives` 两张表 + RLS 策略

### 3. 获取 Supabase 密钥

在 Supabase Dashboard → **Settings → API** 中：

- `Project URL` → 这就是 `SUPABASE_URL`
- `anon public` → 这就是 `SUPABASE_ANON_KEY`（公钥，可以暴露给前端）
- `service_role` → 这就是 `SUPABASE_SERVICE_ROLE_KEY`（管理员密钥，**绝对不要**给前端）

### 4. 获取 AI API Key

1. 访问 [sg.uiuiapi.com](https://sg.uiuiapi.com)，注册/登录
2. 在控制台创建 API Key
3. 复制 Key，这就是 `UIUI_API_KEY`

### 5. 部署到 Vercel

**方式一：通过 Git（推荐）**

```bash
# 克隆或复制项目到本地
cd 题链扣

# 安装依赖
npm install

# 登录 Vercel（首次需要）
npx vercel login

# 部署
npx vercel --prod
```

部署过程中，Vercel 会提示你设置环境变量：
- `SUPABASE_URL` = 你的 Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY` = 你的 service_role key
- `SUPABASE_ANON_KEY` = 你的 anon key
- `UIUI_API_KEY` = 你的 uiuiAPI key

**方式二：通过 Vercel Dashboard**

1. 访问 [vercel.com](https://vercel.com)，登录
2. 点击 **New Project** → **Import Git Repository** 或上传文件夹
3. 在 **Environment Variables** 中添加上述 4 个环境变量
4. 点击 **Deploy**

### 6. 配置前端 Supabase 连接

打开 `index.html`，找到文件顶部 `<script>` 中的两行配置：

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

替换为你在 Supabase Dashboard 中获取的实际值。

> ⚠️ `SUPABASE_ANON_KEY` 是公钥，暴露在前端是安全的（有 RLS 保护）。
> `SUPABASE_SERVICE_ROLE_KEY` 是管理员密钥，**只放在 Vercel 环境变量中**。

### 7. 本地开发

```bash
# 安装依赖
npm install

# 创建 .env.local 文件，填入 4 个环境变量
cp .env.example .env.local

# 启动开发服务器
npx vercel dev
```

访问 `http://localhost:3000` 即可。

## 文件结构

```
题链扣/
├── index.html                     # 前端单页应用
├── api/
│   ├── generate.js                # AI 两阶段串题（核心）
│   ├── histories.js                # 获取历史记录列表
│   ├── history/
│   │   └── [id].js                 # 获取单条历史详情
│   └── save-archive.js             # 收藏/取消收藏
├── supabase/
│   └── migrations/
│       └── 01_init.sql             # 数据库建表
├── package.json
├── vercel.json
├── .env.example
└── README.md
```

## 安全说明

- ✅ 所有 AI Prompt 仅存在于后端 `api/generate.js`，前端不包含任何 Prompt
- ✅ AI API Key (`UIUI_API_KEY`) 仅存储在 Vercel 环境变量中，前端无法访问
- ✅ 后端每个 API 都验证 Supabase JWT Token，确保用户只能访问自己的数据
- ✅ 数据库表启用 Row Level Security (RLS)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` 仅在后端使用，不暴露给前端
