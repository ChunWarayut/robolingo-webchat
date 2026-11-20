export default function TypingDots({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
      <span className="flex items-center gap-1 rounded-2xl bg-bubble-peer px-3 py-2.5">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="typing-dot block h-1.5 w-1.5 rounded-full bg-muted"
            style={{ animationDelay: `${index * 0.16}s` }}
          />
        ))}
      </span>
      {label && <span>{label}</span>}
    </div>
  );
}
