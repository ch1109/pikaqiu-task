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
        llm_api_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
        llm_api_key TEXT NOT NULL DEFAULT '',
        llm_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
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
}
