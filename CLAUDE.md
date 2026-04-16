# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

赛博桌宠 (CyberPet) — AMD AI 大赛参赛作品。Tauri 2.0 桌面应用，透明置顶窗口中运行 Lottie 动画桌宠，集成 LLM 对话、任务规划、定时提醒、当日复盘。

## 常用命令

```bash
pnpm dev              # 启动 Vite dev server（前端 HMR，端口 1420）
pnpm tauri dev        # 启动完整 Tauri 应用（前端 + Rust 后端）
pnpm build            # tsc + vite build（仅前端产物，输出 dist/）
pnpm tauri build      # 打包为桌面应用
npx tsc --noEmit      # 仅类型检查（无测试框架，以此为主要静态验证手段）
```

项目无测试框架、无 linter 配置。验证手段：`tsc --noEmit` + `vite build` + `tauri dev` 肉眼确认。

## 架构

### 多窗口路由

单一 Vite 入口 `src/main.tsx`，通过 `getCurrentWindow().label` 分发到 4 个窗口组件：

| label | 组件 | 用途 |
|---|---|---|
| `pet` (默认) | `PetWindow` | 透明置顶桌宠，Lottie 动画 + 气泡交互 |
| `chat` | `ChatPanel` | LLM 对话，自然语言创建/修改任务 |
| `task` | `TaskPanel` | 任务管理，4 个 Tab：日程/任务/提醒/复盘 |
| `settings` | `SettingsPanel` | LLM 配置、工作时段、桌宠外观 |

`pet` 窗口在 `tauri.conf.json` 中定义（400×440、透明、置顶）。其余窗口由 Rust 端 `commands::window::create_*_window` 按需创建。

### 跨窗口状态同步

每个 Tauri WebView 是独立 JS 运行时，Zustand store **各窗口独立实例**。共享层只有 SQLite DB。窗口间同步走 Tauri event bus：

- `tasks-changed`：任何 CRUD 操作后由 store 方法 `emit`，监听方执行 `loadToday()` 拉最新
- `tasks-updated`：ChatPanel 创建任务后广播
- `pet-bubble`：触发桌宠可交互气泡（payload 为 `BubblePayload` 判别联合，`src/types/bubble.ts`）
- `pet-state`：切换桌宠动画状态
- `reminders-changed`：提醒 CRUD 后广播

**关键约束**：`setupTaskAlarms`（`src/services/taskAlarm.ts`）只读不写，不会触发 `tasks-changed`，避免事件回环。

### 数据层

- SQLite 通过 `@tauri-apps/plugin-sql` 在前端 TS 直接操作（`src/services/db.ts`）
- 迁移脚本内联在 `db.ts` 的 `runMigrations()` 中（001-005），非独立 SQL 文件
- 核心表：`settings`（单行）、`daily_plans`、`tasks`、`subtasks`、`task_dependencies`、`chat_messages`、`daily_reviews`、`reminders`
- 完成项永久保留，无自动清理逻辑

### LLM 集成

`src/services/llm/` 提供 `LLMProvider` 接口，两个实现：
- `APIProvider`：调 Rust 端 `commands::llm::llm_chat`（reqwest 发请求，规避前端 CORS）
- `LocalProvider`：预留本地模型（未完整实现）

LLM prompt 模板在 `src/prompts/`（taskExtract / taskDecompose / taskModify），返回严格 JSON。

### 设计系统

- Token 文件：`src/styles/tokens.css`（WildCard Airy Light 风格）
- **命名陷阱**：`--vermilion-*` token 实际存蓝色 `#2E6FEB`（改版遗留，不要按红色理解）
- 语义色：`--moss-*` = emerald 绿（success），`--amber-*` = 警告，`--seal-red` = danger
- 动画：`src/styles/animations.css`，包含 `task-active-glow`（流光边框）、`task-overtime-glow`（超时琥珀）等
- 图标：`src/components/shared/Icon.tsx` 是 lucide-react 薄包装，新增图标**必须先在 `iconMap` 中注册**，否则 TS 报错

### 路径别名

`@` → `./src`（在 `vite.config.ts` 和 `tsconfig.json` 中配置）

## 开发注意事项

### 时间敏感的派生值不能 useMemo

`isOvertime` 等依赖 `dayjs()` 当前时钟的值必须每次 render 内联计算。`useMemo` 在 task 字段不变时不会重算，导致跨过时间边界后视觉不更新。re-render 由 `taskAlarm` 到点 emit `tasks-changed` 驱动。

### TaskDetailsPopover 的 readOnly 模式

`readOnly?: boolean` + `subtasks?: SubTask[]` 两个可选 prop。readOnly 下所有编辑区 `pointer-events: none`，底部 AI/删除块不渲染。用于复盘清单回看已完成任务详情。调用时传空函数占位 `onUpdate/onDecompose/onDelete`。

### sessionStorage 去重

`taskAlarm.ts` 用 `sessionStorage` key `taskAlarm:${id}:${kind}:${YYYY-MM-DD}` 做同日去重。跨天自动失效（日期后缀变化）。`clearAlarmDedup` 仅在"顺延时间"场景调用。

### 密度约束

TaskPanel 窗口 400×440 固定不可调。任务列表可视高度约 254px，未展开卡片 ~56px（含 gap 12）。`expanded` 默认 false，由用户主动点击展开。修改 padding/gap 时注意验证 5 张卡可一览。

## Rust 端

- `src-tauri/src/lib.rs`：插件注册 + invoke handler
- `src-tauri/src/commands/window.rs`：窗口创建（chat/task/settings）
- `src-tauri/src/commands/llm.rs`：`llm_chat` / `llm_check`，reqwest 代理 LLM 请求
- `src-tauri/src/tray.rs`：系统托盘菜单

DB 操作全在前端 TS 完成（通过 plugin-sql），Rust 端不参与 SQL。
