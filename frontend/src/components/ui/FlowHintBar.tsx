type FlowBadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

type FlowBadge = {
  label: string;
  tone?: FlowBadgeTone;
};

type FlowAction = {
  label: string;
  onClick: () => void;
};

type FlowHintBarProps = {
  title: string;
  badges: FlowBadge[];
  helper?: string;
  actions?: FlowAction[];
  className?: string;
};

const toneClassMap: Record<FlowBadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  info: "bg-blue-100 text-blue-700 border-blue-200",
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  danger: "bg-rose-100 text-rose-700 border-rose-200",
};

export default function FlowHintBar({
  title,
  badges,
  helper,
  actions = [],
  className = "",
}: FlowHintBarProps) {
  return (
    <div className={`bg-white p-3 rounded-2xl border border-slate-200 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-700">{title}</span>
        {badges.map((badge, index) => {
          const tone = badge.tone || "neutral";
          return (
            <span
              key={`${badge.label}-${index}`}
              className={`px-2 py-1 text-[10px] font-semibold rounded border ${toneClassMap[tone]}`}
            >
              {badge.label}
            </span>
          );
        })}
      </div>

      {helper ? (
        <p className="mt-2 text-[11px] text-slate-500">{helper}</p>
      ) : null}

      {actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action, index) => (
            <button
              key={`${action.label}-${index}`}
              onClick={action.onClick}
              className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
