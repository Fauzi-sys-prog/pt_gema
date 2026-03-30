type StatusGuideTone = "neutral" | "info" | "success" | "warning" | "danger";

type StatusGuideItem = {
  label: string;
  description: string;
  tone?: StatusGuideTone;
};

type StatusGuideSection = {
  title: string;
  items: StatusGuideItem[];
};

type StatusGuideCardProps = {
  title: string;
  helper?: string;
  sections: StatusGuideSection[];
  className?: string;
};

const toneClassMap: Record<StatusGuideTone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  info: "bg-blue-100 text-blue-700 border-blue-200",
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  danger: "bg-rose-100 text-rose-700 border-rose-200",
};

export default function StatusGuideCard({
  title,
  helper,
  sections,
  className = "",
}: StatusGuideCardProps) {
  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm ${className}`}>
      <div className="mb-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">{title}</h2>
        {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sections.map((section) => (
          <div key={section.title} className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-3">
              {section.title}
            </h3>
            <div className="space-y-3">
              {section.items.map((item) => {
                const tone = item.tone || "neutral";
                return (
                  <div key={`${section.title}-${item.label}`} className="flex flex-col gap-2">
                    <span
                      className={`inline-flex w-fit px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border ${toneClassMap[tone]}`}
                    >
                      {item.label}
                    </span>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
