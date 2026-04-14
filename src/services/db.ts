import Database from "@tauri-apps/plugin-sql";

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
}
