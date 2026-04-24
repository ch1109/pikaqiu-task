# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

赛博桌宠 (CyberPet) — AMD AI 大赛参赛作品。Tauri 2.0 桌面应用，透明置顶窗口中运行桌宠（内置 Pika SVG 或用户自定义角色），集成 LLM 对话、任务规划、定时提醒、当日复盘、AI 生图/生视频形象工作室。

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

单一 Vite 入口 `src/main.tsx`，通过 `getCurrentWindow().label` 分发到 5 个窗口组件：

| label | 组件 | 用途 |
|---|---|---|
| `pet` (默认) | `PetWindow` | 透明置顶桌宠，SVG / 自定义 sprite + 气泡交互 |
| `chat` | `ChatPanel` | LLM 对话，自然语言创建/修改任务；支持技能 `/command` 和多会话 |
| `task` | `TaskPanel` | 任务管理，4 个 Tab：日程/任务/提醒/复盘 |
| `settings` | `SettingsPanel` | LLM 配置、工作时段、桌宠形象（AI 创建 / 本地导入） |
| `character-studio` | `CharacterStudio` | 桌宠形象工作室，AI 生图 + 可选 Veo 生视频的向导式流程 |

`pet` 窗口在 `tauri.conf.json` 中定义（400×440、透明、置顶）。其余窗口由 Rust 端 `commands::window::create_*_window` 按需创建。

### 跨窗口状态同步

每个 Tauri WebView 是独立 JS 运行时，Zustand store **各窗口独立实例**。共享层只有 SQLite DB。窗口间同步走 Tauri event bus：

- `tasks-changed`：任何 CRUD 操作后由 store 方法 `emit`，监听方执行 `loadToday()` 拉最新
- `tasks-updated`：ChatPanel 创建任务后广播
- `pet-bubble`：触发桌宠可交互气泡（payload 为 `BubblePayload` 判别联合，`src/types/bubble.ts`）
- `pet-state`：切换桌宠动画状态
- `reminders-changed`：提醒 CRUD 后广播
- `skills-updated`：技能开关 / 新增后广播
- `character-changed`：激活角色切换 / 删除 / 新建后广播（常量 `CHARACTER_CHANGED` in `services/character.ts`）

**关键约束**：`setupTaskAlarms`（`src/services/taskAlarm.ts`）只读不写，不会触发 `tasks-changed`，避免事件回环。

### 数据层

- SQLite 通过 `@tauri-apps/plugin-sql` 在前端 TS 直接操作（`src/services/db.ts`）
- 迁移脚本内联在 `db.ts` 的 `runMigrations()` 中（当前已到 014），非独立 SQL 文件；每条迁移用 `INSERT INTO _migrations (name) VALUES (...)` 记录，幂等重跑
- 新增迁移的约定：在末尾追加 `if (!done) { ... ; INSERT INTO _migrations }` 块，不要改既有迁移
- 核心表：
  - **任务域**：`settings`（单行）、`daily_plans`、`tasks`、`subtasks`、`task_dependencies`、`chat_messages`、`chat_sessions`、`daily_reviews`、`reminders`
  - **工作流**：`preset_prompts`（预设提示词）、`skills`（/command 技能）
  - **角色**：`custom_characters`（角色元数据）、`character_animations`（动作 + 视频路径 + 色键参数）、`character_drafts`（向导中间态）
- 完成项永久保留，无自动清理逻辑

### 桌宠渲染分层

`PetSprite.tsx` 是顶层分发：
- 若 `useCharacterStore.active` 存在 → `SpriteRenderer`（读 `character_animations` 的 `frames_dir` 渲染 PNG 序列帧，或检测到 `video_path` 时走 `ChromaKeyVideo`）
- 否则渲染内置 Pika SVG（`state`/`idleAction` 绑定 `pika-state-*` / `pika-idle-*` class 驱动 CSS 动画）

`ChromaKeyVideo.tsx` 用 Canvas 2D + requestAnimationFrame 做**运行时实时色键**：绿幕像素 → alpha=0，透明帧贴到桌宠窗口。参数（`keyColor`/`tolerance`/`clipBlack`）默认 `#00FF00`/80/true，可被 `character_animations.chroma_key_color/chroma_key_tolerance`覆盖。AI 生成的 Veo 视频和本地导入视频共用这条链路。

### 角色系统

- **AI 创建**：`CharacterStudio` 窗口走 4 步向导（灵感 → 基准图 → 帧生成 → 预览），中间态写 `character_drafts`；完成后用 `createCharacterWithAnimations` 写入正式表
- **本地导入**：`LocalImportDialog.tsx` 弹窗（用 `createPortal(document.body)` 避开 `.stagger-child` 的 transform containing block 陷阱），支持基准图/视频二选一；仅视频时从首帧 canvas 抽 PNG 作为 `base.png`
- **色键调参**：`ChromaKeyTuner.tsx` 左右双 canvas（首帧取色 + 实时抠色预览），参数存入 animation 记录而非 settings

### LLM / 图像 / 视频 Provider

- `src/services/llm/` — `LLMProvider` 接口；`APIProvider` 调 Rust `commands::llm::llm_chat` 代理 reqwest 请求（规避前端 CORS）；LLM prompt 模板在 `src/prompts/`（taskExtract / taskDecompose / taskModify），返回严格 JSON
- `src/services/image/` — 图像生成 Provider（即梦 Jimeng / ComfyUI 双通道），Rust 命令在 `commands/image.rs`
- `src/services/video/` — 视频生成 Provider（Gemini Veo image-to-video），Rust 命令在 `commands/video.rs`，返回后用 ffmpeg 抠绿幕输出 WebM alpha（需系统 PATH 有 `ffmpeg`）

### 技能与预设

- `skills` 表：每条技能 = `trigger`（/命令）+ `prompt_template`；`skillParser` 识别用户输入的 `/xxx` 并替换为完整 prompt 发给 LLM
- `preset_prompts` 表：对话快捷按钮（`PresetBar`），点击把 prompt 注入输入框

### 设计系统

- Token 文件：`src/styles/tokens.css`（WildCard Airy Light 风格）
- **命名陷阱**：`--vermilion-*` token 实际存蓝色 `#2E6FEB`（改版遗留，不要按红色理解）
- 语义色：`--moss-*` = emerald 绿（success），`--amber-*` = 警告，`--seal-red` = danger
- 动画：`src/styles/animations.css`，包含 `task-active-glow`（流光边框）、`task-overtime-glow`（超时琥珀）、`stagger-fade-up` 等
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

### 设置窗口内的 fixed 弹窗陷阱

`SettingsPanel.tsx` 的内容区是 `.stagger-child`，动画结束后 `transform: translateY(0)` 被 `animation-fill-mode: both` 保留。任何 `position: fixed` 后代都会被劫持为"相对该容器"而非视口，宽度溢出则被 `.glass-panel { overflow: hidden }` 裁切导致"弹窗点了没反应"。解决：弹窗必须用 `createPortal(..., document.body)` 逃到 body 层。

## Rust 端

- `src-tauri/src/lib.rs`：插件注册 + `invoke_handler!` 入口
- `src-tauri/src/commands/window.rs`：窗口创建（chat / task / settings / character-studio）
- `src-tauri/src/commands/llm.rs`：`llm_chat` / `llm_check`，reqwest 代理 LLM 请求
- `src-tauri/src/commands/image.rs`：即梦 / ComfyUI 图像生成代理
- `src-tauri/src/commands/video.rs`：Veo 提交/轮询/下载 + ffmpeg chromakey
- `src-tauri/src/commands/character.rs`：角色目录下的字节落盘 / 读取（`character_save_bytes` / `character_read_bytes` 等）
- `src-tauri/src/tray.rs`：系统托盘菜单

DB 操作全在前端 TS 完成（通过 plugin-sql），Rust 端不参与 SQL。
