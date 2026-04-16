# CyberPet · 项目长期记忆

## 数据管理

### 完成项保留策略
- **策略**：完成的任务永久保留。`tasks` 表无 `deleted_at` 字段、无自动清理任务、无启动期 prune 脚本。
- **用户删除**：仅通过 `TaskCard` 的"删除任务"按钮触发硬删（`useTaskStore.deleteTask`），级联删除该任务下的所有子任务。
- **UI 回看窗口**：`DailyReview` 支持 14 / 30 / 90 / 180 天切换；柱状图每根柱条可点击就地展开当日完成清单；每行再次点击打开 `TaskDetailsPopover`（readOnly 模式）查看任务原始信息。
- **查询路径**：按日明细走 `useTaskStore.loadCompletedByDate(date)`；按日统计走 `loadHistory(days)`。两者均只读，不进 store 状态。
- **长期空间评估**：日均 ~30 完成项 × 180 天 ≈ 5400 行 × ~200B ≈ 1 MB，SQLite 可直接扫描 `DATE(completed_at) = ?` 无需加索引。

## 界面密度约定

`TaskPanel` 固定 400×440 窗口，任务列表可视高度约 254px。为保证 5 张未展开卡片可一览：
- `TaskList` 外层：`padding: 18 20 24; gap: 12`
- `TaskCard` 头部：`padding: 14 16`；子任务区：`padding: 8 16 12 24`
- `TaskCard.expanded` **不再**按 `status==='active'` 自动展开，改由用户点击头部切换。active 任务的视觉锚点依赖 `task-active-glow` 边框 + 左侧优先级色条。

## 跨窗口状态同步

Tauri 多窗口架构下 `useTaskStore` 是**每窗口独立实例**，共享只有 SQLite DB。同步靠事件总线：
- `tasks-changed`：CRUD + PetWindow 气泡动作触发，监听方执行 `loadToday()`
- `tasks-updated`：ChatPanel 创建任务后广播
- `pet-bubble` / `pet-state` / `reminders-changed`：其余 UI 联动

## 任务详情 Popover 的 readOnly 模式

`TaskDetailsPopover` 新增 `readOnly?: boolean` + `subtasks?: SubTask[]`：
- readOnly 下：编辑 Row 整体 `pointer-events: none; opacity: 0.82`，底部"AI 拆解 / 删除"不渲染，超时横幅不渲染；顶部补"已完成"胶囊 + 完成时刻
- 用于复盘清单点击行回看任务详情；非只读调用方无需改动

## 关键踩坑

- `isOvertime` 不能 `useMemo`：该值依赖 `dayjs()` 当前时钟，任务字段不变但跨过 `planned_end_time` 的那一刻必须重算；依赖 `taskAlarm` 在到点 emit `tasks-changed` 触发 re-render
- `--vermilion-*` token 在 WildCard Airy Light 改版后实际存的是蓝色 `#2E6FEB`；命名保留以减小改动面，流光边框等故意复用
- sessionStorage dedup key 必须带 `YYYY-MM-DD` 后缀，确保跨天自动失效
- `TaskList.onUpdateTaskFields` 的类型要包含 `planned_start_time/planned_end_time`，否则时间锚点编辑 props 漏传

## 技术栈要点

- React 18 + Zustand 5（**未装** `subscribeWithSelector` 中间件，跨窗口同步走事件总线）
- `@tauri-apps/plugin-sql` 共享 SQLite；schema 见 `src-tauri/migrations/001_init.sql`
- 设计系统 tokens 在 `src/styles/tokens.css`；动画 keyframes 在 `src/styles/animations.css`
- 图标：`src/components/shared/Icon.tsx` 是 lucide-react 的静态注册薄包装，新增图标必须先注册 `iconMap`
