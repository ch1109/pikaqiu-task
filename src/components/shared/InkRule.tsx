/**
 * InkRule — 单一水平分隔线
 *
 * - 默认：铺满父宽的 1px 墨线
 * - `accent`：24px 宽的蓝色短线（焦点装饰）
 */
interface InkRuleProps {
  accent?: boolean;
  margin?: string | number;
}

export default function InkRule({ accent = false, margin }: InkRuleProps) {
  return (
    <div
      style={{
        margin,
        height: accent ? 2 : 1,
        width: accent ? 24 : "100%",
        background: accent ? "var(--vermilion-600)" : "var(--rule-line)",
        borderRadius: accent ? 999 : 0,
      }}
    />
  );
}
