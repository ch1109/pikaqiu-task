import Database from "@tauri-apps/plugin-sql";
import { BUILTIN_SKILLS } from "@/services/seeds/skills";

let db: Database | null = null;

export async function getDB(): Promise<Database> {
  if (db) return db;
  db = await Database.load("sqlite:cyberpet.db");
  await runMigrations(db);
  return db;
}

async function runMigrations(database: Database) {
  // 创建迁移版本跟踪表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  // 检查 001_init 是否已执行
  const applied = await database.select<{ name: string }[]>(
    "SELECT name FROM _migrations WHERE name = '001_init'"
  );

  if (applied.length === 0) {
    await database.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        work_start TEXT NOT NULL DEFAULT '09:00',
        work_end TEXT NOT NULL DEFAULT '18:00',
        break_mins INTEGER NOT NULL DEFAULT 10,
        llm_mode TEXT NOT NULL DEFAULT 'api' CHECK (llm_mode IN ('api','local')),
        llm_api_url TEXT NOT NULL DEFAULT 'https://ark.cn-beijing.volces.com/api/coding/v1',
        llm_api_key TEXT NOT NULL DEFAULT 'f634f22e-6059-4430-a3d6-0f4de4a60e8e',
        llm_model TEXT NOT NULL DEFAULT 'doubao-seed-2-0-code-preview-260215',
        local_model_path TEXT NOT NULL DEFAULT '',
        pet_x REAL NOT NULL DEFAULT 100.0,
        pet_y REAL NOT NULL DEFAULT 100.0,
        opacity REAL NOT NULL DEFAULT 0.8,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `);
    await database.execute("INSERT OR IGNORE INTO settings (id) VALUES (1)");

    await database.execute(`
      CREATE TABLE IF NOT EXISTS daily_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        raw_input TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        deadline TEXT,
        priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
        category TEXT NOT NULL DEFAULT 'general',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','skipped')),
        sort_order INTEGER NOT NULL DEFAULT 0,
        estimated_mins INTEGER NOT NULL DEFAULT 60,
        actual_mins INTEGER,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        depends_on_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, depends_on_id),
        CHECK (task_id != depends_on_id)
      )
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS subtasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        estimated_mins INTEGER NOT NULL DEFAULT 15,
        actual_mins INTEGER,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','skipped')),
        scheduled_start TEXT,
        scheduled_end TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER REFERENCES daily_plans(id) ON DELETE SET NULL,
        role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS daily_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL UNIQUE REFERENCES daily_plans(id) ON DELETE CASCADE,
        total_tasks INTEGER NOT NULL DEFAULT 0,
        completed_tasks INTEGER NOT NULL DEFAULT 0,
        skipped_tasks INTEGER NOT NULL DEFAULT 0,
        total_estimated_mins INTEGER NOT NULL DEFAULT 0,
        total_actual_mins INTEGER NOT NULL DEFAULT 0,
        overtime_task_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `);

    // 索引
    await database.execute("CREATE INDEX IF NOT EXISTS idx_tasks_plan ON tasks(plan_id)");
    await database.execute("CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id)");
    await database.execute("CREATE INDEX IF NOT EXISTS idx_plans_date ON daily_plans(date)");

    await database.execute("INSERT INTO _migrations (name) VALUES ('001_init')");
  }

  // 迁移 002：更新默认 LLM 配置为火山引擎 Coding API
  const applied002 = await database.select<{ name: string }[]>(
    "SELECT name FROM _migrations WHERE name = '002_volcano_llm'"
  );
  if (applied002.length === 0) {
    await database.execute(
      `UPDATE settings SET
        llm_api_url = 'https://ark.cn-beijing.volces.com/api/coding/v1',
        llm_api_key = 'f634f22e-6059-4430-a3d6-0f4de4a60e8e',
        llm_model = 'doubao-seed-2-0-code-preview-260215'
      WHERE id = 1 AND llm_api_key = ''`
    );
    await database.execute("INSERT INTO _migrations (name) VALUES ('002_volcano_llm')");
  }

  // 迁移 003：自定义定时提醒表（TaskPanel「提醒」Tab）
  const applied003 = await database.select<{ name: string }[]>(
    "SELECT name FROM _migrations WHERE name = '003_reminders'"
  );
  if (applied003.length === 0) {
    await database.execute(`
      CREATE TABLE IF NOT EXISTS reminders (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        title           TEXT NOT NULL,
        next_trigger_at TEXT NOT NULL,
        repeat_kind     TEXT NOT NULL DEFAULT 'none'
                        CHECK (repeat_kind IN ('none','daily','weekdays')),
        weekdays        TEXT,
        enabled         INTEGER NOT NULL DEFAULT 1,
        last_fired_at   TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `);
    await database.execute(
      "CREATE INDEX IF NOT EXISTS idx_reminders_next ON reminders(next_trigger_at)"
    );
    await database.execute("INSERT INTO _migrations (name) VALUES ('003_reminders')");
  }

  // 迁移 004：扩展 reminders 支持 interval 模式（重建表 —— CHECK 约束无法 ALTER）
  const applied004 = await database.select<{ name: string }[]>(
    "SELECT name FROM _migrations WHERE name = '004_reminders_interval'"
  );
  if (applied004.length === 0) {
    await database.execute(`
      CREATE TABLE reminders_new (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        title            TEXT NOT NULL,
        next_trigger_at  TEXT NOT NULL,
        repeat_kind      TEXT NOT NULL DEFAULT 'none'
                         CHECK (repeat_kind IN ('none','daily','weekdays','interval')),
        weekdays         TEXT,
        interval_minutes INTEGER,
        window_start     TEXT,
        window_end       TEXT,
        enabled          INTEGER NOT NULL DEFAULT 1,
        last_fired_at    TEXT,
        created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `);
    await database.execute(`
      INSERT INTO reminders_new
        (id, title, next_trigger_at, repeat_kind, weekdays, enabled, last_fired_at, created_at, updated_at)
      SELECT id, title, next_trigger_at, repeat_kind, weekdays, enabled, last_fired_at, created_at, updated_at
      FROM reminders
    `);
    await database.execute("DROP TABLE reminders");
    await database.execute("ALTER TABLE reminders_new RENAME TO reminders");
    await database.execute(
      "CREATE INDEX IF NOT EXISTS idx_reminders_next ON reminders(next_trigger_at)"
    );
    await database.execute(
      "INSERT INTO _migrations (name) VALUES ('004_reminders_interval')"
    );
  }

  // 迁移 005：任务时间锚点（可选 HH:mm 起止，空表示浮动）
  const applied005 = await database.select<{ name: string }[]>(
    "SELECT name FROM _migrations WHERE name = '005_task_planned_time'"
  );
  if (applied005.length === 0) {
    await database.execute(
      "ALTER TABLE tasks ADD COLUMN planned_start_time TEXT"
    );
    await database.execute(
      "ALTER TABLE tasks ADD COLUMN planned_end_time TEXT"
    );
    await database.execute(
      "INSERT INTO _migrations (name) VALUES ('005_task_planned_time')"
    );
  }

  // 迁移 006：预设提示词表
  const applied006 = await database.select<{ name: string }[]>(
    "SELECT name FROM _migrations WHERE name = '006_preset_prompts'"
  );
  if (applied006.length === 0) {
    await database.execute(`
      CREATE TABLE IF NOT EXISTS preset_prompts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        content     TEXT NOT NULL,
        icon        TEXT NOT NULL DEFAULT 'sparkles',
        sort_order  INTEGER NOT NULL DEFAULT 0,
        is_builtin  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `);
    // 内置种子数据
    await database.execute(
      "INSERT INTO preset_prompts (name, content, icon, sort_order, is_builtin) VALUES ('翻译', '请将以下内容翻译为英文：\n', 'sparkles', 0, 1)"
    );
    await database.execute(
      "INSERT INTO preset_prompts (name, content, icon, sort_order, is_builtin) VALUES ('润色', '请润色以下文字，使其更加流畅自然：\n', 'pen-line', 1, 1)"
    );
    await database.execute(
      "INSERT INTO preset_prompts (name, content, icon, sort_order, is_builtin) VALUES ('总结', '请用 3-5 个要点总结以下内容：\n', 'scroll-text', 2, 1)"
    );
    await database.execute(
      "INSERT INTO preset_prompts (name, content, icon, sort_order, is_builtin) VALUES ('解释', '请用通俗易懂的方式解释以下概念：\n', 'lightbulb', 3, 1)"
    );
    await database.execute(
      "INSERT INTO _migrations (name) VALUES ('006_preset_prompts')"
    );
  }

  // 迁移 007：清理预设重复数据 + 唯一约束
  const applied007 = await database.select<{ name: string }[]>(
    "SELECT name FROM _migrations WHERE name = '007_preset_dedup'"
  );
  if (applied007.length === 0) {
    // 保留每个 name 的最小 id 行，删除其余重复
    await database.execute(`
      DELETE FROM preset_prompts WHERE id NOT IN (
        SELECT MIN(id) FROM preset_prompts GROUP BY name
      )
    `);
    // 加唯一索引防止未来重复
    await database.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_preset_name ON preset_prompts(name)"
    );
    await database.execute(
      "INSERT INTO _migrations (name) VALUES ('007_preset_dedup')"
    );
  }

  // 迁移 008：技能（Skills）系统 —— /command 触发的结构化工作流
  const applied008 = await database.select<{ name: string }[]>(
    "SELECT name FROM _migrations WHERE name = '008_skills'"
  );
  if (applied008.length === 0) {
    await database.execute(`
      CREATE TABLE IF NOT EXISTS skills (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT NOT NULL,
        display_name TEXT NOT NULL,
        description  TEXT NOT NULL,
        when_to_use  TEXT NOT NULL DEFAULT '',
        prompt       TEXT NOT NULL,
        icon         TEXT NOT NULL DEFAULT 'wand-2',
        action_key   TEXT,
        model        TEXT,
        sort_order   INTEGER NOT NULL DEFAULT 0,
        is_builtin   INTEGER NOT NULL DEFAULT 0,
        enabled      INTEGER NOT NULL DEFAULT 1,
        created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `);
    await database.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_name ON skills(name)"
    );
    await database.execute(
      "CREATE INDEX IF NOT EXISTS idx_skills_sort ON skills(sort_order)"
    );

    // 内置 skill —— 数据定义在 seeds/skills.ts
    for (const s of BUILTIN_SKILLS) {
      await database.execute(
        `INSERT INTO skills
          (name, display_name, description, when_to_use, prompt, icon, action_key, sort_order, is_builtin, enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 1)`,
        [
          s.name,
          s.display_name,
          s.description,
          s.when_to_use,
          s.prompt,
          s.icon,
          s.action_key,
          s.sort_order,
        ]
      );
    }

    await database.execute("INSERT INTO _migrations (name) VALUES ('008_skills')");
  }

  // 迁移 009：追加内置 skill-creator（对 008 之后新增的种子做幂等补齐）
  const applied009 = await database.select<{ name: string }[]>(
    "SELECT name FROM _migrations WHERE name = '009_skill_creator'"
  );
  if (applied009.length === 0) {
    const creator = BUILTIN_SKILLS.find((s) => s.name === "skill-creator");
    if (creator) {
      // 使用 INSERT OR IGNORE 防止 idx_skills_name 唯一约束冲突
      // （理论上 008 只插了 plan/review/focus/breakdown，skill-creator 不会冲突；
      //  但用户若已手动建过同名技能，尊重用户版本）
      await database.execute(
        `INSERT OR IGNORE INTO skills
          (name, display_name, description, when_to_use, prompt, icon, action_key, sort_order, is_builtin, enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 1)`,
        [
          creator.name,
          creator.display_name,
          creator.description,
          creator.when_to_use,
          creator.prompt,
          creator.icon,
          creator.action_key,
          creator.sort_order,
        ]
      );
    }
    await database.execute(
      "INSERT INTO _migrations (name) VALUES ('009_skill_creator')"
    );
  }

  // 迁移 010：独立 chat_sessions 表 + chat_messages.session_id
  // 目的：让 chat 脱离 plan 耦合，支持「新对话」/「历史浏览」/跨天自动切换
  // 策略：保留 chat_messages.plan_id 不动，仅追加 session_id 列 + 迁移既有数据
  const applied010 = await database.select<{ name: string }[]>(
    "SELECT name FROM _migrations WHERE name = '010_chat_sessions'"
  );
  if (applied010.length === 0) {
    await database.execute(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        title      TEXT NOT NULL DEFAULT '新对话',
        date       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `);
    await database.execute(
      "CREATE INDEX IF NOT EXISTS idx_chat_sessions_date ON chat_sessions(date)"
    );
    await database.execute(
      "CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at)"
    );

    // 在 chat_messages 上增列 session_id（无 FK，避免 SQLite ALTER 限制；删除级联靠应用层）
    await database.execute(
      "ALTER TABLE chat_messages ADD COLUMN session_id INTEGER"
    );
    await database.execute(
      "CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id)"
    );

    // 数据迁移：把既有消息按 plan_id 聚合成 sessions
    const msgExists = await database.select<{ cnt: number }[]>(
      "SELECT COUNT(*) AS cnt FROM chat_messages"
    );
    if (msgExists[0]?.cnt > 0) {
      // 1) 每个非空 plan_id 创建一条 session
      const planGroups = await database.select<{
        plan_id: number;
        date: string;
        raw_input: string;
        created_at: string;
      }[]>(
        `SELECT p.id AS plan_id, p.date, p.raw_input, p.created_at
         FROM daily_plans p
         WHERE EXISTS (SELECT 1 FROM chat_messages m WHERE m.plan_id = p.id)`
      );
      for (const g of planGroups) {
        const title =
          g.raw_input && g.raw_input.trim()
            ? g.raw_input.trim().slice(0, 20)
            : "历史对话";
        // 取该 plan 最后一条消息时间作为 updated_at，贴近用户认知
        const lastRows = await database.select<{ last_at: string }[]>(
          `SELECT MAX(created_at) AS last_at FROM chat_messages WHERE plan_id = $1`,
          [g.plan_id]
        );
        const updatedAt = lastRows[0]?.last_at ?? g.created_at;
        const ins = await database.execute(
          `INSERT INTO chat_sessions (title, date, created_at, updated_at)
           VALUES ($1, $2, $3, $4)`,
          [title, g.date, g.created_at, updatedAt]
        );
        await database.execute(
          "UPDATE chat_messages SET session_id = $1 WHERE plan_id = $2",
          [ins.lastInsertId, g.plan_id]
        );
      }

      // 2) plan_id IS NULL 的孤儿消息聚合成一条 session
      const orphanAgg = await database.select<{
        cnt: number;
        first_at: string | null;
        last_at: string | null;
      }[]>(
        `SELECT COUNT(*) AS cnt,
                MIN(created_at) AS first_at,
                MAX(created_at) AS last_at
         FROM chat_messages WHERE plan_id IS NULL AND session_id IS NULL`
      );
      if ((orphanAgg[0]?.cnt ?? 0) > 0 && orphanAgg[0].first_at) {
        const firstAt = orphanAgg[0].first_at;
        const lastAt = orphanAgg[0].last_at ?? firstAt;
        const date = firstAt.slice(0, 10);
        const ins = await database.execute(
          `INSERT INTO chat_sessions (title, date, created_at, updated_at)
           VALUES ('历史对话', $1, $2, $3)`,
          [date, firstAt, lastAt]
        );
        await database.execute(
          "UPDATE chat_messages SET session_id = $1 WHERE plan_id IS NULL AND session_id IS NULL",
          [ins.lastInsertId]
        );
      }
    }

    await database.execute(
      "INSERT INTO _migrations (name) VALUES ('010_chat_sessions')"
    );
  }
}
