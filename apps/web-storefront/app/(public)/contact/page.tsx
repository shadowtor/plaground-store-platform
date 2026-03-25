/**
 * Contact page — public-facing contact form.
 *
 * Accessible without auth.
 * Four-state contract: idle, loading (submit), success, error.
 * Rate limiting is enforced at the API layer (not here).
 *
 * Server action submits the form; inline validation via Zod.
 * Error messages appear below the field (never toast-only).
 */

import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the PLAground team. We respond to all enquiries within one business day.",
  openGraph: {
    title: "Contact — PLAground",
    description: "Get in touch with the PLAground team.",
  },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-xl">
        {/* Page heading */}
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">
          Contact us
        </h1>
        <p className="text-[var(--foreground-muted)] mb-8">
          Have a question or a custom project in mind? We respond to all
          enquiries within one business day.
        </p>

        <ContactForm />

        {/* Alternative contact info */}
        <div className="mt-8 pt-8 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--foreground-muted)]">
            You can also reach us at{" "}
            <a
              href="mailto:hello@plaground.store"
              className="text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-sm"
            >
              hello@plaground.store
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
