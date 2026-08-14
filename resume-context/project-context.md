# 赛博桌宠 CyberPet · 项目履历上下文包

> 本文档基于代码库与 PRD 实证生成，供后续撰写 PDF 简历、网页版简历、作品集和面试话术使用。
> 生成日期：2026-06-05 ｜ 代码库快照：commit `af9fd5e`（master 分支，19 commits）

## 📌 证据标记图例（全文遵守）

| 标记 | 含义 | 简历使用规则 |
|---|---|---|
| ✅ | **代码已验证**——可在仓库中找到对应实现 | 可写成成果性 bullet |
| 📋 | **PRD 规划（代码未实现）**——仅存在于需求文档 | 只能表述为"设计/规划了"，**禁止写成"实现了"** |
| 【需确认】/【需要我补充】 | 仅项目作者本人知道的信息 | 补充确认后方可使用 |

**最重要的诚实边界（面试官 5 分钟可验证）**：
- ❌ 代码中**没有**端侧 LLM / ONNX Runtime / DirectML / NPU 推理代码。PRD 将"端侧推理 + AMD NPU 加速"定为核心竞争力（PRD 1.3、NFR-007），但实际实现中 LLM 走云 API 代理（默认火山豆包），本地推理仅预留了 Ollama 兼容接口（`src/services/llm/local-provider.ts`，默认 `http://localhost:11434/v1`），`settings.local_model_path` 字段预留未实装。
- ❌ 代码中**没有** SQLite 加密（PRD NFR-005 规划，实际为明文 `@tauri-apps/plugin-sql`）。
- ❌ 生图/生视频默认调用**云端**供应商，与 PRD"数据全部本地处理保护隐私"叙事相悖（本地通道仅 ComfyUI 可选）。
- 【需确认】端侧→云 API 的偏离是主动取舍、时间约束还是 Demo 阶段策略？比赛最终提交形态是哪个版本？——**回答这个问题之前，任何简历/面试材料都不要把"端侧 AI / NPU"写成卖点。**

---

## 1. 项目一句话定位

**赛博桌宠（CyberPet）是一款 Tauri 2.0 桌面 AI 智能伴侣：以透明置顶的桌宠形态包装 LLM 任务规划能力，帮助知识工作者把自然语言描述的"今天要做的事"自动拆解、排程、盯到做完并生成 AI 复盘。**

- 核心价值主张（PRD 原文，✅ 有文档证据）："**把今天要做的事告诉我，我帮你拆解、排布、盯着做完**"
- 参赛背景（✅ PRD 封面）：AMD 锐龙 AI 智能体创新应用大赛「工作学习」赛道参赛作品
- 差异化定位（✅ PRD 第九节"叙事验证"）："这不是又一个 todo-list 工具，而是 AI 理解任务并帮你规划执行"

---

## 2. 目标用户与使用场景

来源：PRD 1.2 节（✅ 有文档证据，且与实现的任务分类 `work/study/life/general` 对应，见 `src/types/task.ts`）：

| 用户层 | 人群 | 场景与痛点 |
|---|---|---|
| 主要用户 | 知识工作者（产品经理、设计师、开发者、内容创作者） | 每天多个并行任务，传统 todo 工具只能记录、不能拆解和排程；任务启动靠自律，超时无人提醒 |
| 次要用户 | 大学生及考研/考证备考人群 | 需要学习计划拆解和时间管理，"复习高数"这类大任务不知如何下手 |
| 边缘用户 | 自由职业者 / 一人公司 | 自我管理多角色任务，缺少"有人盯着"的外部约束感 |

**典型使用流（✅ 代码可复现）**：早晨对桌宠说"今天上午写竞品分析报告，下午 3 点开会，晚上准备演讲稿"→ LLM 解析出多个任务并各自拆解 2-7 个子任务 → 排入时间轴 → 到点桌宠气泡提醒"该开始了"（可选"现在开始/稍后 5 分钟"）→ 超时温和提示 → 一天结束生成 AI 复盘（具体点名完成/未完成 + 一条建议）。

---

## 3. 核心问题

这个项目真正解决的 4 个关键问题（不是功能罗列）：

### 问题 ①：todo 工具只"记录"任务，不"理解"任务
传统工具的最小单元是一行文字。CyberPet 用双层 LLM 调用（路由意图识别 → 任务拆解）把"写竞品分析报告"变成带预估耗时、执行要点、推荐顺序的 2-7 个子任务。
✅ 证据：`src/prompts/chatRouter.ts`（chat / task_new / task_modify 三路意图分发）→ `src/prompts/taskDecompose.ts`（子任务拆解 + best_approach）。

### 问题 ②：自然语言 → 结构化执行之间存在鸿沟
用户不愿意填表单。CyberPet 让用户用一句话输入混杂多任务、模糊时间、优先级暗示的描述，由 LLM 输出严格 JSON（task_name / deadline / priority / category / estimated_mins），并支持自然语言修改（"拆得更细一点"→ redecompose intent）。
✅ 证据：`src/prompts/taskExtract.ts`、`src/prompts/taskModify.ts`（add/delete/modify/redecompose 四类意图）、解析层 `src/services/taskParser.ts`（解析失败 fallback 为普通对话，不阻塞用户）。

### 问题 ③：提醒工具是冷冰冰的弹窗，没有陪伴感
任务执行半途而废往往是情绪问题而非信息问题。CyberPet 把提醒、鼓励、超时提示全部承载在桌宠形态上：10 种表情状态（idle/thinking/encourage/celebrating/sulking…）+ 8 种随机待机小动作 + 可交互气泡（"现在开始/稍后 5 分钟"按钮直接驱动任务状态机）。
✅ 证据：`src/types/pet.ts`（10 PetState + 8 IdleAction）、`src/types/bubble.ts`（task-start / task-end 判别联合）、`src/services/taskAlarm.ts`（时间锚点定时器 + sessionStorage 同日去重）。

### 问题 ④：AI 形象定制对普通用户门槛过高
让用户拥有"自己的"桌宠需要生图、生视频、绿幕抠像等专业能力。CyberPet 把这条链路产品化为 4 步向导：一句话灵感 → LLM 润色 prompt → 生成基准图（4 张候选）→ 各动作生成帧/视频 → ffmpeg 抠绿幕输出透明 WebM → 直接成为桌宠。
✅ 证据：`src/windows/CharacterStudio.tsx` + `src/components/character/` 向导组件、`src-tauri/src/commands/video.rs`（Veo 提交/轮询/下载 + ffmpeg chromakey）、`character_drafts` 表保存中间态支持断点续作。

---

## 4. 我的可能贡献点

**作者归属证据**：git 历史共 19 条提交（2026-04-09 至 2026-06-05，跨 57 天），**提交者全部为 ch1109，无其他贡献者**。据此推断为个人独立完成的全栈项目，但仍标【需确认：是否有未体现在 git 中的协作者（如设计素材、PRD 评审）】。

以下贡献点按简历可用性排列，每条附代码证据：

1. ✅ **独立完成产品全周期**【需确认】：从 EARS 方法论 PRD（`cyberpet_prd.docx`）→ 8 个阶段的渐进式开发（git 提交 Phase 1-8 清晰可循）→ 设计系统改版迭代，PRD 与代码均出自同一人之手。
2. ✅ **设计并实现 Tauri 多窗口架构**：单 Vite 入口按窗口 label 分发 5 个窗口组件（`src/main.tsx`），各 WebView 独立 JS 运行时下用"SQLite 共享层 + Tauri 事件总线（10 个事件）"解决跨窗口状态同步（详见第 7 节）。
3. ✅ **构建双层 LLM 任务引擎与 8 个 Prompt 模板**：意图路由 → 任务提取 → 子任务拆解 → 任务修改 → AI 复盘 → 技能执行 → 技能生成 → 形象 prompt 构造，全部严格 JSON 输出 + 解析失败降级（`src/prompts/` 8 个文件）。
4. ✅ **接入 8 家 AI 供应商、共 13 条生图/生视频集成通道的统一 Provider 体系**：图像 6 条（即梦/可灵/海螺/ComfyUI/OpenAI 兼容/Replicate）+ 视频 7 条（Gemini Veo/即梦/可灵/海螺/Vidu/Replicate/ComfyUI），含可灵 HS256 JWT 签名（轮询前重签防过期）、ComfyUI workflow 注入、各家异步任务轮询策略（`src/services/image/providers/`、`src-tauri/src/commands/image.rs`、`video.rs`）。
5. ✅ **打通 AI 视频 → 桌宠渲染的完整媒体管线**：Veo 生成绿幕视频 → ffmpeg `chromakey` 滤镜输出 VP9 + alpha 通道 WebM → 前端 Canvas 2D 运行时逐像素色键（容差可调）→ 透明置顶窗口渲染（`src-tauri/src/commands/video.rs`、`src/components/pet/ChromaKeyVideo.tsx`、`src/components/character/ChromaKeyTuner.tsx` 双 canvas 调参器）。
6. ✅ **维护 19 个幂等 SQLite 迁移、14 张业务表的数据层**：迁移内联于 `src/services/db.ts`，每条用 `_migrations` 元表记录、只追加不修改既有迁移，从初始 7 张业务表演进到含角色/技能/会话/复盘的 14 张业务表。
7. ✅ **建立两层 token 设计系统 + 深浅主题**：`tokens.css` 语义底座（brand/surface/ink/语义色 + dark 覆盖）→ `globals.css` 旧别名映射，换主题色只改源头一处；自绘 `WindowTitleBar`/`TabBar`/缩放角统一 4 个面板窗口外壳（commit `af9fd5e`）。
8. 📋 **撰写 EARS 规范的 PRD**：五类需求句式（Ubiquitous/Event-driven/State-driven/Optional/Unwanted）× P0/P1/P2 分级，含 MVP 范围界定、5 分钟 Demo 演示脚本、风险应对表——这是产品能力的直接证据（注意：PRD 中端侧推理部分未落地，引用时须区分）。

---

## 5. 核心功能模块

### 模块 A：桌宠本体（透明置顶伴侣）

- **用户价值**：常驻桌面、不打扰但随时可交互的情感化入口；任务提醒以可爱气泡而非系统弹窗出现。
- **相关实现** ✅：
  - 窗口：`src/windows/PetWindow.tsx`（气泡分发、待机小动作 90~180s 随机调度）
  - 渲染分层：`src/components/pet/PetSprite.tsx`（内置 Pika SVG / 自定义角色分发）→ `SpriteRenderer.tsx`（WebM 视频优先、PNG 帧回落、Blob URL 生命周期管理）→ `ChromaKeyVideo.tsx`（运行时色键）
  - 状态：`src/types/pet.ts`（10 PetState + 8 IdleAction）、`src/stores/usePetStore.ts`
  - 交互：`src/types/bubble.ts` 判别联合（task-start 带"现在开始/稍后 5 分钟"、task-end 带"已完成/还没完成"）
  - Rust：`tauri.conf.json` pet 窗口 400×640 透明置顶；`get_pet_cursor_local_pos` 支持鼠标穿透坐标换算（`src-tauri/src/commands/window.rs`）
- **简历写法**：适合作为"情感化 AI 交互设计"+"透明窗口/Canvas 渲染工程"双料案例；网页简历放一段桌宠待机 + 气泡交互的 GIF 最有说服力。

### 模块 B：LLM 对话与任务引擎

- **用户价值**：一句话生成结构化日程；追加对话即可修改任务，无需任何表单。
- **相关实现** ✅：
  - 窗口：`src/windows/ChatPanel.tsx`（多会话 + 技能 /command + 预设提示词）
  - 调用链：`ChatPanel` → `buildChatRouterMessages()`（`src/prompts/chatRouter.ts`）→ `useLLM` → `APIProvider.chat()` → Rust `llm_chat`（reqwest 代理，OpenAI 兼容 `/chat/completions`，规避 WebView CORS）→ `parseRouterResult()`（`src/services/taskParser.ts`）→ `useTaskStore.addTask/addSubtask` → `emit("tasks-changed")`
  - 数据：`chat_sessions` / `chat_messages`（迁移 010 将会话与日计划解耦）、`tasks` / `subtasks` / `task_dependencies`
- **简历写法**："自然语言 → 严格 JSON → 数据库 → 跨窗口同步"这条端到端链路是 FDE 面试的最佳叙事素材；可画一张调用链图。

### 模块 C：任务面板与执行提醒

- **用户价值**：4 Tab（日程/任务/提醒/足迹）覆盖"看排程 → 管任务 → 设提醒 → 看复盘"完整闭环；到点提醒和超时提示自动驱动。
- **相关实现** ✅：
  - 窗口：`src/windows/TaskPanel.tsx`（580×820 可调，masthead 标题随 Tab 变化）
  - 排程：`src/services/scheduler.ts`（时段分配）+ `src/services/conflictDetector.ts`（deadline/overflow/anchor 三类冲突）
  - 提醒：`src/services/taskAlarm.ts`（planned_start/end 时间锚点 → 气泡；sessionStorage `taskAlarm:{id}:{kind}:{YYYY-MM-DD}` 同日去重，跨天自动失效；只读不写防事件回环）+ `src/services/reminder.ts`（none/daily/weekdays/interval 四种重复模式的自定义提醒）
  - 细节：`isOvertime` 必须 render 内联计算而非 useMemo（依赖实时时钟）——`CLAUDE.md` 记录的真实踩坑
- **简历写法**：适合体现"产品闭环思维"（输入→执行→复盘）+"时间敏感系统的工程细节"（去重、防回环、时钟派生值）。

### 模块 D：AI 当日复盘

- **用户价值**：一天结束后自动聚合完成率/耗时对比，并由 LLM 以当前桌宠角色的口吻生成 3-5 句"具体、诚实、向前"的复盘话术（约束：具体点名任务、诚实提未完成、只给一条建议——反"虚夸鸡汤"设计）。
- **相关实现** ✅：`src/components/review/DailyReview.tsx`、`src/services/review.ts`（generateReflection 读取任务分组 + 注入角色 persona）、`src/prompts/dailyReflect.ts`、`daily_reviews` 表（迁移 019 增加 `ai_reflection` / `ai_reflection_at` 缓存）
- **简历写法**：这是"Prompt 约束设计"的精华案例——输出不是 JSON 而是带产品价值观约束的自然语言，体现对 LLM 输出质量的产品级把控。

### 模块 E：桌宠形象工作室（AI 生图/生视频）

- **用户价值**：零专业门槛创造专属桌宠——一句话灵感即可获得带动作动画的角色；也支持本地图片/视频导入 + 可视化色键调参。
- **相关实现** ✅：
  - 向导：`src/windows/CharacterStudio.tsx`（860×640）+ `src/components/character/steps/`（灵感 → 基准图 → 动作清单 → 帧生成 → 预览确认 5 步）
  - 中间态：`character_drafts` 表存 JSON payload（含 frames_done 进度），支持中断恢复
  - 生成：`src/services/characterGenerator.ts`（编排 LLM 润色 + 图像 Provider + 帧间 reference_strength 0.7 保持一致性）；可选视频 `src/services/video/`（提交 → 10s 间隔轮询 → 下载 → `video_chroma_key` ffmpeg 抠像）
  - 落盘：`src-tauri/src/commands/character.rs`（路径穿越校验 `ensure_safe_relative`、`draft_promote_to_character` rename 优先/copy+delete 兜底的原子搬迁）
  - 本地导入：`LocalImportDialog.tsx`（createPortal 逃逸 transform containing block 陷阱；仅视频时从首帧抽 PNG 作 base）+ `ChromaKeyTuner.tsx`（左取色右预览双 canvas）
- **简历写法**：最适合作为"AI 能力产品化"的封面案例——把生图/生视频/抠像专业工作流折叠成消费级向导；含成本意识（`providerCatalog.ts` 标注各家每秒人民币费率、`imageQuota.ts` 每日配额限流）。

### 模块 F：技能系统与预设提示词

- **用户价值**：高频 AI 操作沉淀为 `/command` 一键触发（如 /plan /review /focus /breakdown）；甚至可用自然语言让 AI 生成新技能（skill-creator 元能力）。
- **相关实现** ✅：`skills` 表（trigger + prompt_template + action_key）、`src/services/skillParser.ts`（/xxx 解析与补全）、`src/services/skillRegistry.ts`（pet_focus / refresh_tasks / create_skill 副作用处理器注册表）、`src/prompts/skillCreatorPrompt.ts`（LLM 生成技能定义 JSON 即插即用）、`preset_prompts` 表 + `PresetBar.tsx`（翻译/润色/总结/解释 4 内置预设）
- **简历写法**："可复用 AI 工作流沉淀"的直接证据——尤其 skill-creator（用 AI 生成 AI 技能）适合 AI 产品岗位叙事。

---

## 6. 产品设计价值

### 信息架构
✅ 5 窗口各司其职且边界清晰：桌宠（情感触点 + 轻交互）/ 对话（自然语言入口）/ 任务（结构化管理）/ 设置（配置中心）/ 形象工作室（创作流程）。重交互不挤进桌宠小窗，而是按需唤起独立窗口——这是对"不打扰"原则的架构级贯彻。

### 用户流程
✅ 完整闭环：自然语言输入 → 解析确认 → 拆解 → 排程 → 到点提醒 → 执行跟踪 → 超时干预 → AI 复盘。PRD 2.2 数据流定义与代码实现一一对应。📋 PRD 还规划了 5 分钟参赛 Demo 演示脚本（七步：唤醒→输入→解析→拆解→排布→执行→复盘，每步标注"突出价值点"）——演示流程本身就是被设计过的产品。

### 页面结构
✅ TaskPanel 4 Tab 对应任务生命周期四阶段；masthead 单一大标题原则（避免双重标题）；TaskCard 默认折叠、用户主动展开（密度控制）；复盘清单用 `TaskDetailsPopover` readOnly 模式回看已完成任务（同一组件双形态复用，见 `CLAUDE.md` 开发注意事项）。

### 功能边界（克制的产品决策）
- ✅ 完成项**永久保留**、无自动清理——为长期复盘留数据（`.claude/PROJECT.md` 记录了空间评估：日均约 30 项 × 180 天 ≈ 1 MB，量级判断后才拍板）
- ✅ AI 复盘话术约束"只给一条建议"——抵抗 LLM 长篇说教倾向
- ✅ 提醒同日去重 + 跨天自动失效——既不骚扰也不漏报
- 📋 PRD 明确把"精力曲线排程、周趋势分析、预估耗时自动校准"划入 P2 不做——MVP 范围控制

### 关键产品判断
- ✅ **桌宠是包装而非装饰**：所有任务事件（开始/超时/完成）都路由到桌宠气泡而非系统通知，把工具行为转译为陪伴行为
- ✅ **修改也走自然语言**：不做编辑表单的平替，而是 taskModify 四类意图（add/delete/modify/redecompose），保持交互一致性
- ✅ **AI 生成失败永不阻塞**：路由 JSON 解析失败降级为普通聊天；子任务拆解失败保留主任务——LLM 不可靠性的产品级兜底

### 重要取舍（如实陈述）
- ⚠️ **端侧推理 → 云 API**：PRD 以"端侧 LLM + AMD NPU、零云端依赖"为核心竞争力（P0 级 NFR-001/002/003），实际实现为云 API 代理 + Ollama 本地选项，无 NPU 代码。【需确认：偏离原因（模型质量？时间？端侧拆解质量风险在 PRD 第八节已被预判）与比赛最终提交形态】——确认前不要在任何材料中将端侧/NPU 作为已实现卖点；可以诚实讲述为"规划与现实的差距及我的应对"，这反而是好的面试素材。
- ✅ **多供应商而非绑定单家**：生图/生视频做成 6+7 家可切换 Provider 并标注每秒费率，把供应商风险和成本透明度做成产品特性。
- ✅ **自定义角色从多帧动画简化为单帧 + CSS 容器动画**（commit `8ba5e52`）：生成式 AI 难以保证帧间一致性，主动降级为更稳的方案——承认技术边界的取舍。

**对 AI 产品经理能力的证明**：EARS + P0/P1/P2 的需求工程方法、围绕 LLM 不可靠性的降级设计、AI 输出的价值观约束（复盘话术三原则）、成本/配额的产品化（费率目录 + 每日限额）、MVP 范围与 Demo 叙事设计——这些是"懂 AI 边界的 PM"区别于"功能型 PM"的核心证据。

---

## 7. 工程实现价值

### 技术栈 ✅
- **桌面容器**：Tauri 2.0（Rust），插件：sql/shell/notification/process/fs；前端 React 18 + TypeScript 5.5 + Vite 6 + Zustand 5 + dayjs + zod + lucide-react
- **Rust 端**：reqwest（HTTP 代理）、tokio、jsonwebtoken（可灵 JWT）、serde、uuid、base64、chrono
- **媒体**：系统 ffmpeg（chromakey 滤镜 + libvpx-vp9）；前端 Canvas 2D 实时色键
- **规模**：120 个 TS/TSX 文件 22,817 行 + 10 个 Rust 文件 2,556 行；19 commits / 57 天

### 项目架构 ✅
- **多窗口单入口路由**：`src/main.tsx` 按 `getCurrentWindow().label` 分发 5 窗口；pet 窗口由 `tauri.conf.json` 静态定义，其余 4 窗由 Rust `commands/window.rs` 按需创建（均无装饰 + 透明 + 可调，自绘标题栏/缩放角）
- **职责分层**：DB 操作全部在前端 TS（plugin-sql），Rust 端只做"前端做不了的事"——窗口管理、HTTP 代理（CORS）、文件落盘、ffmpeg 调用、托盘

### 数据流与状态管理 ✅
- **核心难题**：每个 Tauri WebView 是独立 JS 运行时，Zustand store 各窗口独立实例，**没有共享内存**
- **解法**：SQLite 作唯一共享层 + Tauri 事件总线做失效通知（10 个事件：tasks-changed / tasks-updated / pet-bubble / pet-state / reminders-changed / reminder / reminder-fired / skills-updated / character-changed / settings-changed），监听方收到事件后各自 `loadToday()` 拉取
- **防回环纪律**：`taskAlarm` 只读不写、不 emit `tasks-changed`；提醒去重用 sessionStorage 带日期后缀的 key
- 11 个 Zustand store 按域拆分（task/chat/chatSession/pet/character/characterDraft/settings/preset/skill/reminder/theme）

### 接口设计 ✅
- Rust 端 28 个 invoke 命令按域分组（窗口 5 / LLM 2 / 图像 5 / 角色 10 / 视频 6，见 `src-tauri/src/lib.rs`）
- `llm_chat` 统一 OpenAI 兼容格式，火山豆包 / Ollama / 任意兼容端点共用一条通道
- Provider 抽象：图像 6 家 / 视频 7 家，前端 `src/services/image|video/` 统一接口 + Rust 端按 provider 分发；各家差异被封装——可灵 HS256 JWT（30 分钟过期、轮询前重签、容忍 5s 时钟偏差）、MiniMax file_id 二步取件、Replicate model/version 字段自适应、ComfyUI workflow 占位符注入（PROMPT/IMAGE_B64/SEED）
- 轮询策略按供应商定制：ComfyUI 180×1s、Veo 120×5s、Seedance 90×10s；错误信息携带原始响应体便于诊断

### 安全与健壮性 ✅
- 路径穿越校验（`ensure_safe_relative` 拒绝 `..` 和绝对路径）
- 草稿→正式角色的原子搬迁（rename 优先，跨设备 fallback copy+delete）
- 每个供应商命令带超时（LLM 健康检查 5s、提交 60s、下载 240s）
- LLM JSON 解析失败逐级降级，不让 AI 失败打断用户

### 部署与工程复杂度 ✅
- 跨平台打包（tauri build，targets all）；系统托盘（显示/退出）；macOS 透明窗口去阴影（`set_shadow(false)` 防黑边）
- 鼠标穿透与可交互区域动态切换（`get_pet_cursor_local_pos` 全局坐标→窗口逻辑坐标换算）
- 透明窗口字体渲染陷阱：入场动画 keyframe 收尾 `transform:none` 脱离 GPU 合成层防文字发虚（`src/styles/animations.css`，CLAUDE.md 记录）
- ⚠️ 诚实边界：无测试框架、无 linter，验证手段为 `tsc --noEmit`（strict 模式）+ `vite build` + 人工验证；无 CI——面试被问质量保障时按此如实回答（见第 12 节追问 7）

**对 FDE / AI 工程交付能力的证明**：在"多运行时无共享内存"的真实约束下设计出可靠同步方案；把 8 家 AI 供应商的 13 条生图/生视频集成通道（鉴权方式、轮询协议、响应结构各不相同）收敛为统一 Provider 抽象；端到端打通"LLM 文本 → 生图 → 生视频 → 视频处理 → 实时渲染"的跨模态管线——这正是 FDE"把不标准的外部世界接成标准接口"的日常。

---

## 8. AI 协作或 AI 产品价值

### 8.1 产品内的 AI：LLM 被产品化的 5 种方式 ✅

| AI 能力 | 解决的问题 | 产品化手段 | 证据 |
|---|---|---|---|
| 意图路由 | 一个输入框承载聊天/建任务/改任务三种意图 | 严格 JSON 的 Router prompt，解析失败降级为聊天 | `src/prompts/chatRouter.ts` |
| 任务拆解 | 大任务无从下手 | 约束 2-7 个子任务、耗时加和≈主任务估时、附 best_approach | `src/prompts/taskDecompose.ts` |
| 任务修改 | 避免编辑表单、保持对话交互 | 四类意图（add/delete/modify/redecompose）结构化输出 | `src/prompts/taskModify.ts` |
| AI 复盘 | 复盘流于形式或沦为鸡汤 | persona 注入 + 三原则约束（具体点名/诚实提未完成/只给一条建议） | `src/prompts/dailyReflect.ts` |
| 技能元生成 | 用户自定义 AI 工作流门槛高 | LLM 生成技能定义 JSON（含 trigger/prompt/action_key）入库即用 | `src/prompts/skillCreatorPrompt.ts` |

**Prompt 工程的共性纪律**（✅ 可在 8 个模板中逐一指认）：严格 JSON 禁 markdown 代码块；时间归一化（HH:MM）；枚举值白名单（priority/category）；模板占位符注入上下文（`{{current_tasks}}` `{{now}}` `{{pet_name}}`）；每个 JSON 出口都有解析降级路径。

### 8.2 AI 生成媒体的工作流产品化 ✅

把"生图 → 图生视频 → 绿幕抠像 → 透明渲染"这条通常需要 ComfyUI + 剪辑软件的专业流水线，折叠为 4 步消费级向导，并沉淀了可复用资产：
- ComfyUI workflow 模板（`src/services/image/workflows/comfyuiSdxlTxt2img.ts`、`comfyuiVideoI2v.ts`）+ 用户自定义 workflow JSON 注入机制
- 角色 prompt 模板（基准图 prompt + 动作 delta prompt + 强制绿幕/居中约束，`src/prompts/characterPrompt.ts`）
- 供应商费率目录与每日配额（`src/services/video/providerCatalog.ts` 标注 0~2.7 元/秒、`src/services/imageQuota.ts`）——AI 成本意识产品化

### 8.3 AI 辅助开发：用 AI 造 AI 产品的工程化协作

- ✅ PRD 技术选型表明示选择 React 的理由之一是"**Claude Code 生成效率高**"——AI 协作从 day 1 进入技术决策
- ✅ 仓库内沉淀了完整的 AI 协作上下文工程：`CLAUDE.md`（约 10KB 架构文档：事件约定、命名陷阱、密度约束、fixed 弹窗陷阱等可执行规则）+ `.claude/PROJECT.md`（长期记忆：踩坑记录、空间评估、约定）——这不是普通 README，而是**面向 AI 协作者的结构化上下文**，使 57 天 19 次提交保持架构一致性
- 【需确认】AI 协作的具体比例与分工方式（哪些由 AI 生成、哪些人工编写/审查），面试前需对此有清晰口径

**如何写进 AI 产品 / FDE 简历**：8.1 证明"懂得给 LLM 立规矩"（输出契约 + 降级），8.2 证明"能把多模态 AI 链路交付成产品"，8.3 证明"会用上下文工程管理 AI 协作"——三者分别对应 AI 产品岗、FDE 岗、以及当下所有岗位都看重的 AI 原生工作方式。

---

## 9. 可见证据地图

| 证据 | 形式建议 | 证明什么能力 |
|---|---|---|
| 桌宠待机 + 气泡交互 | 10-15s 屏录 GIF（待机小动作 → 到点气泡 →点"现在开始"） | 情感化 AI 交互设计；透明置顶窗口工程 |
| 一句话生成日程全程 | 30s Demo 视频：输入混杂多任务一句话 → 任务列表 + 子任务展开 | 核心 AI 价值主张的端到端兑现 |
| TaskPanel 四 Tab | 截图 ×4（日程时间轴 / 任务分组 / 提醒 / 复盘卡片） | 产品闭环与信息架构 |
| AI 复盘卡片 | 截图（含 AI 生成的复盘话术） | Prompt 价值观约束的实际效果 |
| 形象工作室向导 | 截图 ×4 或 60s 视频（灵感→基准图候选→帧生成进度→预览） | AI 工作流产品化 |
| 色键调参器 | 截图（左取色右实时预览双 canvas） | 专业工具消费化的细节功力 |
| 深浅主题对比 | 同一窗口 light/dark 并排截图 | 设计系统能力 |
| `cyberpet_prd.docx` | 节选 2-3 页（EARS 表格 + MVP 分级 + Demo 脚本） | 需求工程方法论（PM 核心证据） |
| `src/prompts/` 8 个文件 | 代码片段（chatRouter 的 JSON 契约 + dailyReflect 的三原则） | Prompt 工程能力 |
| `src/services/db.ts` 迁移段 | 代码片段（019 条迁移的幂等模式） | 数据层演进纪律 |
| `src-tauri/src/commands/video.rs` | 代码片段（Kling JWT 重签 + ffmpeg chromakey 命令行） | 异构 API 集成与媒体处理 |
| `CLAUDE.md` + `.claude/PROJECT.md` | 截图或节选 | AI 协作上下文工程（独特加分项） |
| 任务链路流程图 | **建议绘制**：ChatPanel → chatRouter → taskParser → SQLite → 事件总线 → TaskPanel/PetWindow | 系统思维（网页简历核心插图） |
| 形象生成链路流程图 | **建议绘制**：灵感 → LLM 润色 → 生图(6 Provider) → 生视频(7 Provider) → ffmpeg → Canvas 色键 → 桌宠 | 多模态 AI 管线交付能力 |
| git 提交历史 | `git log --oneline` 截图（Phase 1-8 渐进） | 工程节奏与原子化提交习惯 |

【需要我补充】：是否已有参赛 Demo 视频/答辩 PPT？是否获奖或入围？这些是作品集最强证据，优先级最高。

---

## 10. 简历表达草稿

> 公式：通过【动作】，解决【问题】，产出【结果/产物】，体现【能力】。所有 bullet 仅含代码/文档可证实内容；【需确认】项确认后可强化。

### AI 产品经理版

1. 以 EARS 需求语法 + P0/P1/P2 分级独立撰写桌面 AI 伴侣产品 PRD（含 MVP 界定、5 分钟 Demo 叙事脚本、风险应对表），解决"AI 项目需求发散、演示无重点"问题，最终交付与 PRD 数据流一一对应的可运行产品，体现 AI 产品需求工程能力。
2. 设计"意图路由 → 任务拆解 → 自然语言修改"双层 LLM 调用架构与 8 个严格 JSON 输出的 Prompt 模板（含解析失败降级策略），解决"自然语言到结构化任务的鸿沟"和"LLM 输出不可靠"两大问题，实现一句话生成含子任务/耗时/优先级的当日日程，体现对 LLM 能力边界的产品化把控。
3. 为 AI 复盘功能设计"具体点名、诚实提未完成、只给一条建议"的输出价值观约束并注入桌宠 persona，解决 AI 复盘沦为空洞鸡汤的问题，产出用户可感知差异的每日复盘卡片，体现 AI 输出质量的产品判断力。
4. 将"生图 → 图生视频 → 绿幕抠像"专业流水线产品化为 4 步消费级向导（支持中断恢复、候选图比选、可视化抠像调参），并以供应商费率目录 + 每日配额把 AI 成本透明化，解决普通用户 AI 形象定制门槛过高问题，体现 AI 能力产品化与成本意识。
5. 把任务提醒/鼓励/超时干预全部承载于 10 种表情状态的桌宠气泡交互（替代系统弹窗），解决效率工具"有提醒无陪伴"的留存痛点，体现情感化 AI 交互设计能力。

### FDE 工程师版

1. 基于 Tauri 2.0 + React 18 + Rust 独立交付 5 窗口桌面 AI 应用（120 个 TS 文件 2.3 万行 + Rust 2.5 千行），在"每个 WebView 独立 JS 运行时、无共享内存"约束下，设计 SQLite 单一共享层 + 10 事件 Tauri 总线的跨窗口同步方案（含只读服务防回环、sessionStorage 带日期去重），体现复杂桌面架构设计能力。
2. 将 8 家 AI 供应商的 13 条异构集成通道（生图 6 条 + 生视频 7 条：即梦/可灵/海螺/Veo/Vidu/Replicate/ComfyUI/OpenAI 兼容）收敛为统一 Provider 抽象——封装可灵 HS256 JWT 轮询前重签、MiniMax file_id 二步取件、ComfyUI workflow 占位符注入、按供应商定制的轮询超时策略，实现切换供应商零代码修改，体现异构 API 集成与抽象设计能力（FDE 核心场景）。
3. 端到端打通"LLM 文本 → AI 生图 → 图生视频 → ffmpeg VP9+alpha 抠绿幕 → Canvas 2D 运行时逐像素色键 → 透明窗口渲染"跨模态媒体管线，解决 AI 生成视频无法直接作为透明桌宠素材的问题，体现多模态 AI 链路交付能力。
4. 在 Rust 端实现 LLM/生图/生视频 HTTP 代理层（reqwest），统一 OpenAI 兼容接口规避 WebView CORS，附路径穿越校验、原子文件搬迁（rename/copy 降级）、分级超时与错误回显，体现系统边界处的安全与健壮性工程。
5. 维护 19 个幂等 SQLite 迁移（`_migrations` 元表记录、只追加不修改），支撑 14 张业务表从核心任务域到角色/技能/会话/复盘的 57 天持续演进，零数据重置，体现数据层演进纪律。

### AI 教育产品经理版

**判断：不适合主打，可作辅助案例。** 原因（如实）：项目无教学内容、课程结构、学习评估等教育产品核心要素；"备考人群"仅是 PRD 中的次要用户画像（PRD 1.2），代码中没有任何教育场景的专门实现。如果目标岗位是 AI 教育产品，建议将本项目作为"AI 产品能力 + LLM 工程化"的通用能力证明，而非教育领域证明。可勉强迁移的论据仅一条：
- "任务拆解引擎（大任务 → 2-7 个带耗时的子任务 + 推荐路径）与学习计划拆解同构，复盘闭环（预估 vs 实际耗时对比 + AI 反馈）与学习反思机制同构"——只能作为面试口头迁移论证，不建议写成简历 bullet。

### 课程设计 / 学习体验设计版

**判断：不适合。** 原因（如实）：课程设计岗位需要教学目标设计、知识图谱、学习路径、测评体系等产物，本项目均不涉及。强行包装会在追问中露馅。若必须提及，仅可用一句话："设计过'拆解—执行—复盘'的行为改变闭环（任务领域），其机制与学习体验中的目标拆解和反思设计相通"——同样仅限口头。

---

## 11. 网页版简历项目案例结构

> 适合放进个人网站的项目案例页大纲（按区块给出内容要点与素材指引）

### 标题区
- **项目标题**：赛博桌宠 CyberPet —— 会拆任务、盯执行、做复盘的桌面 AI 伴侣
- **一句话定位**："把今天要做的事告诉我，我帮你拆解、排布、盯着做完"
- 标签：`Tauri 2.0` `React 18` `Rust` `LLM` `多模态 AI` `AMD AI 大赛参赛作品`
- 首屏素材：桌宠待机 + 气泡交互 GIF（第 9 节证据 1）

### 我的角色
- 独立开发者【需确认】：PRD 撰写 → 产品设计 → 全栈开发 → 设计系统，git 历史 19 commits / 57 天单人完成
- 开发方式：Claude Code AI 协作开发（仓库内沉淀 CLAUDE.md/PROJECT.md 上下文工程）

### 项目背景
- AMD 锐龙 AI 智能体创新应用大赛「工作学习」赛道
- 洞察：todo 工具只记录不理解，提醒工具只打扰不陪伴

### 核心问题（3-4 条卡片）
直接复用本文第 3 节的问题 ①-④（每条一句话 + 一个界面截图）

### 解决方案
- 一张总架构图：5 窗口 + 事件总线 + SQLite + Rust 代理层 + 8 家 AI 供应商（13 条集成通道）
- 一张任务链路图（第 9 节建议绘制的流程图 1）

### 核心功能展示（4-5 个滚动区块，图文交替）
1. 一句话生成日程（Demo 视频）
2. 桌宠陪伴执行（气泡交互 GIF）
3. AI 当日复盘（复盘卡片截图 + dailyReflect 三原则说明）
4. AI 形象工作室（向导 4 步截图 + 形象生成链路图）
5. 技能系统（/command 演示 + skill-creator 元能力）

### 关键设计决策（3 条，体现判断力）
1. 为什么所有提醒走桌宠气泡而非系统通知（情感化包装）
2. 为什么 LLM 失败永不阻塞用户（降级策略）
3. 为什么完成项永久保留（复盘数据 vs 1MB/半年的空间代价）

### 技术 / AI 工作流亮点（3 条，可折叠展开代码片段）
1. 跨窗口同步：独立运行时 + SQLite + 事件总线（附防回环细节）
2. 8 家 AI 供应商 13 条通道统一抽象（附 Kling JWT 重签代码片段）
3. 绿幕视频 → 透明桌宠的双层色键管线（ffmpeg + Canvas）

### 成果与下一步
- 已交付：可运行的跨平台桌面应用（2.3 万行 TS + 2.5 千行 Rust，19 个迁移、14 张业务表）
- 比赛结果：【需要我补充】
- 下一步（与 PRD P1/P2 一致，诚实标注"规划中"）：端侧推理路径（Ollama 已预留接口）、任务依赖 DAG、周趋势分析

### 面试官快速判断区（页面底部速览卡）
- ✦ 能独立从 PRD 写到交付（EARS 文档 + 19 commits 全栈实现）
- ✦ 懂 LLM 边界：8 个严格 JSON Prompt 模板 + 全链路降级策略
- ✦ 能接脏 API：8 家供应商 13 条通道、多种鉴权方式（Bearer/JWT/Token）与轮询协议收敛为一个抽象
- ✦ 诚实清单：无测试框架（tsc strict + 人工验证）、端侧推理未落地（PRD 规划）、单人项目无协作流程——主动亮短板，换信任

---

## 12. 面试讲述版本

### 30 秒版本

"赛博桌宠是我参加 AMD AI 大赛做的桌面 AI 伴侣，用 Tauri 和 React 独立开发。核心是把 LLM 任务规划能力包进一个桌宠形态：你用一句话说今天要做什么，它帮你拆成子任务、排进时间轴，到点用气泡提醒你，晚上还会用桌宠的口吻给你一段诚实的复盘。工程上比较有意思的是两块：一是接入了 8 家图像和视频生成供应商、共 13 条生成通道并做了统一抽象，让用户能用 AI 生成自己的桌宠形象，包括生视频再用 ffmpeg 抠绿幕变成透明动画；二是 Tauri 多窗口之间没有共享内存，我用 SQLite 加事件总线解决了跨窗口同步。整个项目从 PRD 到代码都是我一个人完成的，大约两个月、两万五千行代码。"

### 2 分钟版本

**（背景与问题，约 20s）**"这个项目源于 AMD 锐龙 AI 智能体大赛的工作学习赛道。我观察到的问题是：todo 工具只能记录任务，不能理解任务——你写下'写竞品分析报告'，它不知道这件事怎么开始；而提醒工具只会弹窗打扰，没有陪伴感。所以我的定位是一句话：把今天要做的事告诉我，我帮你拆解、排布、盯着做完。"

**（产品方案，约 30s）**"产品形态是一只透明置顶的桌宠。用户自然语言输入当日计划，LLM 先做意图路由——判断是闲聊、建任务还是改任务——再对每个任务做二次拆解，输出 2 到 7 个带耗时估算的子任务，排进时间轴。到点桌宠气泡提醒，按钮直接驱动任务状态；超时温和提示；一天结束生成 AI 复盘。复盘的 prompt 我加了三条约束：具体点名任务、诚实提未完成、只给一条建议——就是为了不让它变成 AI 鸡汤。"

**（工程亮点，约 40s）**"工程上有三个我觉得值得讲的点。第一，Tauri 每个窗口是独立 JS 运行时，Zustand store 不共享，我用 SQLite 做唯一数据源、Tauri 事件总线做失效通知，并定了'提醒服务只读不写'这类规则防事件回环。第二，桌宠形象工作室接了 8 家供应商——即梦、可灵、海螺、Veo、Vidu、Replicate、ComfyUI、OpenAI 兼容——生图 6 条通道、生视频 7 条通道，每家的鉴权和轮询协议都不一样，比如可灵要 HS256 JWT 还得在轮询前重签防过期，我把它们收敛成统一的 Provider 抽象，切换供应商零代码改动。第三，AI 生成的绿幕视频要变成透明桌宠，我做了两层处理：Rust 端调 ffmpeg chromakey 滤镜输出带 alpha 的 VP9 WebM，前端再用 Canvas 逐像素色键兜底，用户还能可视化调容差。"

**（诚实收尾，约 20s）**"有一点我会主动说：PRD 最初规划的是端侧 LLM 加 NPU 推理，实际交付走了云 API、只预留了 Ollama 本地接口——这是规划和现实的差距【需确认后补充原因口径】。另外项目没有测试框架，质量靠 TypeScript strict 模式加人工验证，这在单人参赛项目里是我接受的取舍，但我清楚上生产需要补什么。"

### 面试官可能追问的 8 个问题（附建议回答要点与诚实边界）

1. **"PRD 说端侧推理是核心竞争力，为什么代码里没有？"**
   要点：先承认事实（无 ONNX/NPU 代码，LLM 走云 API，Ollama 接口已预留未完全实装）；PRD 第八节其实预判了"端侧拆解质量不稳定"为最高风险。【需确认：真实偏离原因——是端侧 7B 模型 JSON 输出质量不达标？时间不够？请补充真实经过，这道题答得诚恳反而加分，含糊则致命。】

2. **"多窗口为什么不用一个共享 store，比如 Redux + 中间件同步？"**
   要点：Tauri 每个 WebView 是独立运行时，任何前端状态库都无法跨进程共享；候选方案只有 Rust 端做状态中枢或 DB 做共享层。选 SQLite 因为数据本来就要落库，事件总线只传"变了"信号不传数据，避免双写不一致。证据：`CLAUDE.md` 跨窗口状态同步一节。

3. **"色键为什么 ffmpeg 和 Canvas 各做一次，不是重复吗？"**
   要点：不重复——ffmpeg 离线产出带 alpha 的 VP9 WebM 是首选路径；但 alpha WebM 在不同 WebView 的解码支持有差异，且本地导入的视频未经 ffmpeg 处理，Canvas 运行时色键（`ChromaKeyVideo.tsx`）是兼容层 + 本地导入通道，参数还能按动作覆盖（`character_animations.chroma_key_*`）。

4. **"LLM 输出 JSON 解析失败怎么办？任务建一半失败呢？"**
   要点：路由 JSON 失败 → 降级为普通对话回复，不报错；子任务拆解失败 → 保留主任务跳过拆解；每个 prompt 都禁 markdown 代码块并白名单枚举值。证据：`src/services/taskParser.ts`、`ChatPanel.tsx` 流程。可补充：当前未做 LLM 重试队列，是已知改进点。

5. **"8 家供应商 13 条通道的抽象边界在哪里？哪些差异没能抽象掉？"**
   要点：抽象掉的是调用形态（提交/轮询/下载三段式）；没抽象掉的差异沉在配置层——可灵要 AK+SK 两个密钥（`kling_secret_key` 字段）、MiniMax 要 file_id 二步取件、ComfyUI 要用户自带 workflow JSON。诚实承认：这是配置复杂度换代码统一性的取舍，设置面板因此有 6 种 vendor 的动态表单（`custom_provider_config` JSON 字段）。

6. **"没有测试，怎么保证 19 个数据库迁移不弄坏老用户数据？"**
   要点：迁移纪律——只追加不修改既有迁移、每条用 `_migrations` 表幂等记录、SQLite 不支持的 ALTER 用重建表（迁移 004 实例）；验证靠 `tsc --noEmit` strict + 真机回归。诚实承认：单人项目的取舍，上生产首先要补迁移测试和回滚方案。

7. **"桌宠到点提醒，为什么会出现重复提醒/漏提醒？你怎么防的？"**
   要点：sessionStorage key 带 `YYYY-MM-DD` 后缀做同日去重、跨天自动失效；只排 24h 内的定时器，更远的交给 hourly watchdog；"顺延时间"场景需要重新提醒，所以有显式 `clearAlarmDedup`。证据：`src/services/taskAlarm.ts`。这题能体现对时间系统边界 case 的真实思考。

8. **"你说用 Claude Code 协作开发，那哪些是你的工作？"**
   要点：【需确认：请提前准备真实分工口径】。可佐证的事实：PRD、架构决策、`CLAUDE.md`/`PROJECT.md` 里的踩坑记录（如 transform containing block 陷阱、useMemo 时钟派生值 bug）显示了深度的人工调试与架构把控；AI 协作的上下文工程本身（用结构化文档约束 AI 输出一致性）就是一项可讲的能力。原则：把"我负责判断与验证、AI 负责生成"讲清楚，不回避也不贬低 AI 的作用。

---

## 附：【需要我补充】事项汇总清单

| # | 事项 | 影响范围 |
|---|---|---|
| 1 | 比赛最终提交形态（端侧版 or 当前 API 版）与端侧偏离的真实原因 | 第 1/6/12 节，追问 1 的口径 |
| 2 | 比赛结果（是否获奖/入围/答辩） | 第 9/11 节，作品集最强证据 |
| 3 | 是否已有 Demo 视频 / 答辩 PPT | 第 9 节证据地图 |
| 4 | 是否完全独立完成（设计素材、PRD 评审等是否有他人参与） | 第 4/11 节"我的角色" |
| 5 | AI 协作（Claude Code）的实际分工口径 | 第 8.3 节，追问 8 |
| 6 | 是否有任何真实用户/试用者反馈数据 | 各简历 bullet 目前均无用户数据，有则可显著强化 |
