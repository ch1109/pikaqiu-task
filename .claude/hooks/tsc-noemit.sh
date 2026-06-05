#!/usr/bin/env bash
# Stop 钩子：每轮编辑结束后自动跑 tsc --noEmit。
# 本项目无测试框架、无 linter，tsc --noEmit 是唯一静态验证手段（见 CLAUDE.md）。
# 类型检查不通过时以 decision:block 把错误反馈给 Claude，由它修复后再结束。

# 定位项目根：优先用 Claude Code 注入的 CLAUDE_PROJECT_DIR，回退到脚本相对路径
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT" || exit 0

# 读取钩子输入 JSON；若本次 Stop 已由本钩子触发（stop_hook_active），直接放行避免死循环
input=$(cat)
if [ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false' 2>/dev/null)" = "true" ]; then
  exit 0
fi

# 跑类型检查；通过则静默结束本轮
out=$(npx tsc --noEmit 2>&1) && exit 0

# 未通过：把错误打回给 Claude（仅取末尾 80 行，避免过长）
printf '%s' "$out" | tail -80 | jq -Rs '{
  decision: "block",
  reason: ("⛔ tsc --noEmit 类型检查未通过，请先修复以下类型错误再结束：\n\n" + .)
}'
exit 0
