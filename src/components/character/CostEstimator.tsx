import { useEffect, useState } from "react";
import { getImageProvider } from "@/services/image";
import { estimateActionsCost } from "@/services/character";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { videoProviderMeta } from "@/services/video/providerCatalog";
import type { ActionSpec } from "@/types/character";

const JIMENG_UNIT_CNY = 0.05;

interface Props {
  actions: ActionSpec[];
  /** 额外的一次性调用(Step 2 候选的 4 张),参与图像总成本 */
  extraCalls?: number;
}

export default function CostEstimator({ actions, extraCalls = 0 }: Props) {
  const [providerName, setProviderName] = useState<string>("jimeng");
  const [isLocal, setIsLocal] = useState(false);
  const settings = useSettingsStore((s) => s.settings);

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
  }, [settings?.image_gen_provider]);

  const imageUnit = isLocal ? 0 : JIMENG_UNIT_CNY;
  const { totalCalls } = estimateActionsCost(actions, imageUnit);
  const totalImageCalls = totalCalls + extraCalls;
  const imageCost = totalImageCalls * imageUnit;

  // 视频成本估算
  const videoProvider = settings?.video_gen_provider ?? "gemini";
  const videoMeta = videoProviderMeta(videoProvider);
  const videoActions = actions.filter((a) => a.video_enabled);
  const videoCost = videoActions.reduce(
    (sum, a) => sum + (a.video_duration_s ?? 4) * videoMeta.perSecondCNY,
    0
  );
  const hasVideo = videoActions.length > 0;
  const videoIsFree = videoMeta.perSecondCNY === 0;

  const totalCost = imageCost + videoCost;
  const allLocal = isLocal && (videoIsFree || !hasVideo);

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 12,
        background: allLocal ? "var(--moss-100)" : "var(--amber-100)",
        border: `1px solid ${
          allLocal ? "var(--moss-200)" : "var(--amber-200)"
        }`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-900)",
            flex: 1,
          }}
        >
          预估本次生成成本
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono, 'SF Mono', monospace)",
            fontSize: 18,
            fontWeight: 700,
            color: allLocal ? "var(--moss-600)" : "var(--amber-600)",
            letterSpacing: "-0.01em",
          }}
        >
          {allLocal ? "本地 · 免费" : `≈ ¥${totalCost.toFixed(2)}`}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 11,
          color: "var(--ink-500)",
        }}
      >
        <CostRow
          label={`图像 (${providerName}) · ${totalImageCalls} 次调用`}
          value={isLocal ? "本地 · 免费" : `¥${imageCost.toFixed(2)}`}
          highlight={isLocal}
        />
        {hasVideo && (
          <CostRow
            label={`视频 (${videoMeta.shortLabel}) · ${videoActions.length} 条`}
            value={
              videoIsFree ? "本地 · 免费" : `¥${videoCost.toFixed(2)}`
            }
            highlight={videoIsFree}
          />
        )}
      </div>
    </div>
  );
}

function CostRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>{label}</span>
      <span
        style={{
          fontFamily: "var(--font-mono, monospace)",
          color: highlight ? "var(--moss-600)" : "var(--ink-700)",
          fontWeight: highlight ? 600 : 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}
