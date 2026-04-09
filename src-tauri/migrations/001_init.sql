-- CyberPet 数据库初始化

-- 用户设置（单行表）
CREATE TABLE IF NOT EXISTS settings (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    work_start  TEXT NOT NULL DEFAULT '09:00',
    work_end    TEXT NOT NULL DEFAULT '18:00',
    break_mins  INTEGER NOT NULL DEFAULT 10,
    llm_mode    TEXT NOT NULL DEFAULT 'api' CHECK (llm_mode IN ('api','local')),
    llm_api_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    llm_api_key TEXT NOT NULL DEFAULT '',
    llm_model   TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    local_model_path TEXT NOT NULL DEFAULT '',
    pet_x       REAL NOT NULL DEFAULT 100.0,
    pet_y       REAL NOT NULL DEFAULT 100.0,
    opacity     REAL NOT NULL DEFAULT 0.8,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 插入默认设置
INSERT OR IGNORE INTO settings (id) VALUES (1);

-- 每日计划
CREATE TABLE IF NOT EXISTS daily_plans (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL UNIQUE,
    raw_input   TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','completed','abandoned')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 主任务
CREATE TABLE IF NOT EXISTS tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id         INTEGER NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    deadline        TEXT,
    priority        INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    category        TEXT NOT NULL DEFAULT 'general',
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','completed','skipped')),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    estimated_mins  INTEGER NOT NULL DEFAULT 60,
    actual_mins     INTEGER,
    started_at      TEXT,
    completed_at    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 任务依赖
CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_id   INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on_id),
    CHECK (task_id != depends_on_id)
);

-- 子任务
CREATE TABLE IF NOT EXISTS subtasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    estimated_mins  INTEGER NOT NULL DEFAULT 15,
    actual_mins     INTEGER,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','completed','skipped')),
    scheduled_start TEXT,
    scheduled_end   TEXT,
    started_at      TEXT,
    completed_at    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 对话历史
CREATE TABLE IF NOT EXISTS chat_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id     INTEGER REFERENCES daily_plans(id) ON DELETE SET NULL,
    role        TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 当日复盘
CREATE TABLE IF NOT EXISTS daily_reviews (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id              INTEGER NOT NULL UNIQUE REFERENCES daily_plans(id) ON DELETE CASCADE,
    total_tasks          INTEGER NOT NULL DEFAULT 0,
    completed_tasks      INTEGER NOT NULL DEFAULT 0,
    skipped_tasks        INTEGER NOT NULL DEFAULT 0,
    total_estimated_mins INTEGER NOT NULL DEFAULT 0,
    total_actual_mins    INTEGER NOT NULL DEFAULT 0,
    overtime_task_ids    TEXT NOT NULL DEFAULT '[]',
    created_at           TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_tasks_plan ON tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_scheduled ON subtasks(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_plans_date ON daily_plans(date);
CREATE INDEX IF NOT EXISTS idx_chat_plan ON chat_messages(plan_id);
