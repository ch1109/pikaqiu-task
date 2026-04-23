import { useCharacterDraftStore } from "@/stores/useCharacterDraftStore";
import type { WizardStep } from "@/types/character";
import Icon from "@/components/shared/Icon";

interface Props {
  leftLabel?: string;
  rightLabel: string;
  rightDisabled?: boolean;
  rightLoading?: boolean;
  onLeft?: () => void | Promise<void>;
  onRight: () => void | Promise<void>;
  extras?: React.ReactNode;
}

/** 所有向导步骤的底部导航条，固定风格 */
export default function WizardFooter({
  leftLabel = "上一步",
  rightLabel,
  rightDisabled,
  rightLoading,
  onLeft,
  onRight,
  extras,
}: Props) {
  const { draft, setStep } = useCharacterDraftStore();
  const step = draft?.step ?? 1;

  const defaultBack = async () => {
    if (step > 1) await setStep((step - 1) as WizardStep);
  };

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 14,
        borderTop: "1px solid var(--rule-line)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {step > 1 && (
        <button
          className="btn btn-ghost"
          onClick={onLeft ?? defaultBack}
          style={{ padding: "8px 14px", fontSize: 13 }}
        >
          <Icon
            name="arrow-right"
            size="xs"
            style={{ marginRight: 6, transform: "rotate(180deg)" }}
          />
          {leftLabel}
        </button>
      )}
      <div style={{ flex: 1 }}>{extras}</div>
      <button
        className="btn btn-cyan"
        onClick={onRight}
        disabled={rightDisabled || rightLoading}
        style={{ fontSize: 13 }}
      >
        {rightLoading ? "处理中…" : rightLabel}
        {!rightLoading && (
          <Icon name="arrow-right" size="xs" style={{ marginLeft: 6 }} />
        )}
      </button>
    </div>
  );
}
