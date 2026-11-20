/** โครงเปล่าระหว่างโหลดรอบแรก ใช้แทนคำว่า "กำลังโหลด…" เพื่อไม่ให้ layout กระโดด */

export function ConversationSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-1 p-2" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-lg p-2">
          <div className="skeleton h-9 w-9 shrink-0 rounded-full bg-skeleton" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="skeleton h-3 rounded bg-skeleton" style={{ width: `${55 + ((index * 13) % 35)}%` }} />
            <div className="skeleton h-2.5 rounded bg-skeleton" style={{ width: `${35 + ((index * 17) % 45)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageSkeleton() {
  const rows = [
    { mine: false, width: "42%" },
    { mine: true, width: "28%" },
    { mine: false, width: "56%" },
    { mine: true, width: "36%" },
  ];

  return (
    <div className="flex-1 space-y-4 p-4 sm:p-6" aria-hidden>
      {rows.map((row, index) => (
        <div key={index} className={`flex gap-2.5 ${row.mine ? "justify-end" : "justify-start"}`}>
          {!row.mine && <div className="skeleton h-7 w-7 shrink-0 rounded-full bg-skeleton" />}
          <div className="skeleton h-12 rounded-2xl bg-skeleton" style={{ width: row.width }} />
        </div>
      ))}
    </div>
  );
}
