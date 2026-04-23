import { useEffect, useState } from "react";
import { getImageProvider } from "@/services/image";
import { estimateActionsCost } from "@/services/character";
import type { ActionSpec } from "@/types/character";

/** 即梦按张预估成本（参考火山方舟 doubao-seedream-3-0-t2i，约 ¥0.05/张） */
const JIMENG_UNIT_CNY = 0.05;

interface Props {
  actions: ActionSpec[];
  /** 额外的一次性调用（Step 2 候选的 4 张），参与总成本 */
  extraCalls?: number;
}

export default function CostEstimator({ actions, extraCalls = 0 }: Props) {
  const [providerName, setProviderName] = useState<string>("jimeng");
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const p = await getImageProvider();
        setProviderName(p.name);
        setIsLocal(p.isLocal());
      } catch {
        // keep defaults
      }
    })();
  }, []);

  const unit = isLocal ? 0 : JIMENG_UNIT_CNY;
  const { totalCalls } = estimateActionsCost(actions, unit);
  const totalCallsWithExtra = totalCalls + extraCalls;
  const totalCostWithExtra = totalCallsWithExtra * unit;

  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        background: isLocal ? "var(--moss-100)" : "var(--amber-100)",
        border: `1px solid ${isLocal ? "var(--moss-200)" : "var(--amber-200)"}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontSize: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: "var(--ink-900)" }}>
          预估本次生成成本
        </div>
        <div style={{ color: "var(--ink-500)", fontSize: 11, marginTop: 2 }}>
          {providerName} · {totalCallsWithExtra} 次调用
        </div>
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono, 'SF Mono', monospace)",
          fontSize: 16,
          fontWeight: 600,
          color: isLocal ? "var(--moss-600)" : "var(--amber-600)",
        }}
      >
        {isLocal ? "本地 · 免费" : `≈ ¥${totalCostWithExtra.toFixed(2)}`}
      </div>
    </div>
  );
}
