/**
 * TrustSignals — quality, shipping, support, and returns trust blocks.
 * Displayed below the hero and category grid to build purchase confidence.
 */

const signals = [
  {
    icon: "🚀",
    heading: "Fast turnaround",
    body: "Most orders dispatched within 3–5 business days.",
  },
  {
    icon: "🎯",
    heading: "Precision printing",
    body: "±0.2mm tolerance on all standard prints.",
  },
  {
    icon: "💬",
    heading: "Expert support",
    body: "Reach us by email or our contact form — real people, real answers.",
  },
  {
    icon: "🔄",
    heading: "Quality guarantee",
    body: "Not happy? We'll reprint or refund, no questions asked.",
  },
] as const;

export function TrustSignals() {
  return (
    <section
      aria-label="Why PLAground"
      className="border-t border-[var(--border)] bg-[var(--background-subtle)]"
    >
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-[var(--space-2xl,3rem)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {signals.map((signal) => (
            <div key={signal.heading} className="flex flex-col gap-2">
              <span className="text-2xl" aria-hidden="true">{signal.icon}</span>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {signal.heading}
              </h3>
              <p className="text-sm text-[var(--foreground-muted)]">
                {signal.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
