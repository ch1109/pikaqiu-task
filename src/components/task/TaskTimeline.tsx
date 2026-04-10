import dayjs from "dayjs";
import type { ScheduledBlock } from "@/types/task";
import Icon from "@/components/shared/Icon";
import SectionMasthead from "@/components/shared/SectionMasthead";

interface TaskTimelineProps {
  blocks: ScheduledBlock[];
  workStart: string;
  workEnd: string;
}

/** 时间轴每分钟对应的像素高度 */
const PX_PER_MIN = 2.5;
/** 时间块最小高度（单行文字 + padding）*/
const BLOCK_MIN_HEIGHT = 30;
/**
 * 视觉最小占用分钟数：短任务即使时长不够，由于 minHeight 仍会占这么多像素。
 * 用这个值做"视觉重叠"检测，相邻的短任务即使时间不重叠也会被分列。
 */
const VISUAL_MIN_MINS = Math.ceil(BLOCK_MIN_HEIGHT / PX_PER_MIN);
/** 顶部/底部内边距 */
const PAD_TOP = 22;
const PAD_BOTTOM = 22;

interface BlockLayout {
  block: ScheduledBlock;
  startMins: number;
  endMins: number;
  col: number;
  totalCols: number;
}

/**
 * Google Calendar 式列分配：视觉上重叠的 block 横向并排，完全不重叠的回到列 0。
 *
 * 关键：使用 visualEndMins = max(真实 endMins, startMins + VISUAL_MIN_MINS) 做重叠判定，
 * 这样连续的短任务（例如 09:00 / 09:05 / 09:10，各 5 分钟）也会因为 minHeight 导致的
 * 像素叠压而被识别为重叠、分到不同列。
 *
 * 1. 按 startMins 升序排序
 * 2. 维护 active 列表（visualEnd 仍大于当前 start 的 block），新 item 取最小空闲列号
 * 3. 每个"重叠链组"（active 清空即开启新组）内所有 block 的 totalCols = 该组最大 col + 1
 */
function layoutBlocks(
  blocks: ScheduledBlock[],
  start: dayjs.Dayjs,
  today: string,
): BlockLayout[] {
  const items = blocks
    .map((block) => {
      const startMins = dayjs(`${today} ${block.start}`).diff(start, "minute");
      const endMins = dayjs(`${today} ${block.end}`).diff(start, "minute");
      return {
        block,
        startMins,
        endMins,
        visualEndMins: Math.max(endMins, startMins + VISUAL_MIN_MINS),
      };
    })
    .sort((a, b) => a.startMins - b.startMins);

  type WithGroup = BlockLayout & { group: number };
  const results: WithGroup[] = [];
  type Active = { col: number; visualEnd: number };
  let active: Active[] = [];
  let currentGroup = 0;

  for (const it of items) {
    active = active.filter((a) => a.visualEnd > it.startMins);
    if (active.length === 0) currentGroup++;
    const used = new Set(active.map((a) => a.col));
    let col = 0;
    while (used.has(col)) col++;
    active.push({ col, visualEnd: it.visualEndMins });
    results.push({
      block: it.block,
      startMins: it.startMins,
      endMins: it.endMins,
      col,
      totalCols: 0,
      group: currentGroup,
    });
  }

  const groupMax = new Map<number, number>();
  for (const r of results) {
    groupMax.set(r.group, Math.max(groupMax.get(r.group) ?? 0, r.col + 1));
  }
  return results.map(({ group: _g, ...rest }) => ({
    ...rest,
    totalCols: groupMax.get(_g)!,
  }));
}

export default function TaskTimeline({
  blocks,
  workStart,
  workEnd,
}: TaskTimelineProps) {
  const today = dayjs().format("YYYY-MM-DD");
  const start = dayjs(`${today} ${workStart}`);
  const end = dayjs(`${today} ${workEnd}`);
  const totalMins = Math.max(end.diff(start, "minute"), 60);
  const now = dayjs();
  const nowOffset = Math.max(0, Math.min(totalMins, now.diff(start, "minute")));
  const nowTop = PAD_TOP + nowOffset * PX_PER_MIN;

  const totalHeight = PAD_TOP + totalMins * PX_PER_MIN + PAD_BOTTOM;

  // 生成小时刻度
  const hours: { label: string; offset: number }[] = [];
  let cursor = start.startOf("hour");
  if (cursor.isBefore(start)) cursor = cursor.add(1, "hour");
  while (cursor.isBefore(end) || cursor.isSame(end)) {
    hours.push({
      label: cursor.format("HH:mm"),
      offset: cursor.diff(start, "minute"),
    });
    cursor = cursor.add(1, "hour");
  }

  const showNow = now.isAfter(start) && now.isBefore(end);

  const laidOut = layoutBlocks(blocks, start, today);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* 章节刊头 */}
      <div style={{ padding: "22px 22px 16px" }}>
        <SectionMasthead variant="schedule" count={blocks.length || undefined} />
      </div>

      <div
        style={{
          position: "relative",
          padding: `${PAD_TOP}px 22px ${PAD_BOTTOM}px 64px`,
          height: totalHeight,
        }}
      >
      {/* 时间轴竖线 */}
      <div
        style={{
          position: "absolute",
          left: 56,
          top: PAD_TOP,
          height: totalMins * PX_PER_MIN,
          width: 1,
          background: "var(--rule-line)",
        }}
      />

      {/* 小时刻度 */}
      {hours.map((h) => {
        const top = PAD_TOP + h.offset * PX_PER_MIN;
        return (
          <div
            key={h.label}
            style={{
              position: "absolute",
              left: 0,
              top,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transform: "translateY(-50%)",
            }}
          >
            <span
              className="text-mono"
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                width: 44,
                textAlign: "right",
                letterSpacing: "-0.02em",
              }}
            >
              {h.label}
            </span>
            <div
              style={{
                width: 12,
                height: 1,
                background: "var(--rule-line)",
              }}
            />
          </div>
        );
      })}

      {/* 当前时间指示线 */}
      {showNow && (
        <div
          style={{
            position: "absolute",
            left: 52,
            right: 22,
            top: nowTop,
            height: 1.5,
            background: "var(--vermilion-600)",
            borderRadius: 999,
            zIndex: 5,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: -4,
              top: -3,
              width: 8,
              height: 8,
              background: "var(--vermilion-600)",
              borderRadius: 999,
            }}
          />
          <span
            className="smallcaps"
            style={{
              position: "absolute",
              right: 0,
              top: -16,
              fontSize: 10,
              color: "var(--vermilion-600)",
              fontWeight: 600,
              letterSpacing: "0.12em",
            }}
          >
            now · {now.format("HH:mm")}
          </span>
        </div>
      )}

      {/* 时间块 */}
      {laidOut.map(({ block, startMins, endMins, col, totalCols }) => {
        const top = PAD_TOP + startMins * PX_PER_MIN;
        const height = Math.max(
          (endMins - startMins) * PX_PER_MIN,
          BLOCK_MIN_HEIGHT,
        );
        const isCompleted = block.subtask.status === "completed";
        const isActive = block.subtask.status === "active";

        // 三态容器样式：待开始（蓝渐变）/ 进行中（实蓝高亮）/ 已完成（绿渐变 strikethrough）
        const stateStyle: React.CSSProperties = isCompleted
          ? {
              background:
                "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
              border: "1px solid rgba(16, 185, 129, 0.32)",
              borderLeft: "4px solid var(--moss-600)",
              color: "#047857",
              boxShadow:
                "0 2px 6px rgba(16, 185, 129, 0.12), 0 1px 2px rgba(15, 23, 42, 0.04)",
              opacity: 0.92,
            }
          : isActive
            ? {
                background:
                  "linear-gradient(135deg, #2E6FEB 0%, #5F91F5 100%)",
                border: "1px solid #2258C4",
                borderLeft: "4px solid #FFFFFF",
                color: "#FFFFFF",
                boxShadow:
                  "0 10px 28px rgba(46, 111, 235, 0.42), 0 0 0 3px rgba(46, 111, 235, 0.20)",
              }
            : {
                background:
                  "linear-gradient(135deg, #FFFFFF 0%, #F0F6FD 100%)",
                border: "1px solid #D6E3F4",
                borderLeft: "4px solid var(--vermilion-400)",
                color: "var(--ink-800)",
                boxShadow:
                  "0 2px 8px rgba(46, 111, 235, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)",
              };

        // 时间 chip 配色
        const timeChipBg = isActive
          ? "rgba(255, 255, 255, 0.22)"
          : isCompleted
            ? "rgba(16, 185, 129, 0.18)"
            : "rgba(46, 111, 235, 0.10)";
        const timeChipColor = isActive
          ? "#FFFFFF"
          : isCompleted
            ? "#047857"
            : "var(--vermilion-600)";

        return (
          <div
            key={block.subtask.id}
            style={{
              position: "absolute",
              // 左 padding 68px、右 padding 22px，可用宽度 = 100% - 90px
              left: `calc(68px + (100% - 90px) * ${col} / ${totalCols})`,
              width: `calc((100% - 90px) / ${totalCols} - 4px)`,
              top,
              height,
              borderRadius: "var(--radius-md)",
              padding: "6px 10px 6px 9px",
              fontSize: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              transition: "transform 200ms var(--ease-out-back), box-shadow 200ms ease",
              cursor: "default",
              display: "flex",
              alignItems: "center",
              gap: 7,
              ...stateStyle,
            }}
            title={block.subtask.description || block.subtask.name}
          >
            {/* 状态图标 */}
            {isCompleted ? (
              <span
                style={{
                  display: "inline-flex",
                  flexShrink: 0,
                  color: "#047857",
                }}
              >
                <Icon name="check" size={12} color="#047857" accent />
              </span>
            ) : isActive ? (
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "#FFFFFF",
                  boxShadow: "0 0 0 3px rgba(255, 255, 255, 0.35)",
                  flexShrink: 0,
                }}
              />
            ) : (
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  border: "1.5px solid var(--vermilion-600)",
                  flexShrink: 0,
                }}
              />
            )}

            {/* 时间 chip */}
            <span
              className="text-mono"
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                padding: "2px 7px",
                borderRadius: 999,
                background: timeChipBg,
                color: timeChipColor,
                flexShrink: 0,
                lineHeight: 1.3,
              }}
            >
              {block.start}
            </span>

            {/* 任务名 */}
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                minWidth: 0,
                fontWeight: isActive ? 600 : 500,
                textDecoration: isCompleted ? "line-through" : "none",
                opacity: isCompleted ? 0.85 : 1,
              }}
            >
              {block.subtask.name}
            </span>
          </div>
        );
      })}

      {blocks.length === 0 && (
        <div
          style={{
            position: "absolute",
            left: 68,
            right: 22,
            top: PAD_TOP + 48,
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          还没有排程 — 先去「任务」添加
        </div>
      )}
      </div>
    </div>
  );
}
