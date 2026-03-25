/**
 * ContactForm — public contact form component.
 *
 * Four-state contract:
 *   - Idle: empty form
 *   - Loading: submit button shows spinner, form disabled
 *   - Success: success message replaces the form
 *   - Error: error message + field-level errors shown below each input
 *
 * Validation:
 *   - Client-side: React Hook Form + Zod (via packages/contracts)
 *   - Server-side: server action validates with same Zod schema
 *
 * Accessibility:
 *   - aria-live region for async feedback (success/error)
 *   - Error messages are associated with their inputs via aria-describedby
 *   - Focus management: on success, heading receives focus
 */

"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input, Textarea, Button } from "packages/ui";
import { contactFormSchema, type ContactForm as ContactFormData } from "packages/contracts";
import { submitContactForm, type ContactFormState } from "@/app/actions/contact";

const initialState: ContactFormState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      loading={pending}
      disabled={pending}
      fullWidth
    >
      Send message
    </Button>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactForm, initialState);
  const successHeadingRef = React.useRef<HTMLHeadingElement>(null);

  const {
    register,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    mode: "onBlur",
  });

  // Move focus to success message for screen reader users
  React.useEffect(() => {
    if (state.status === "success") {
      successHeadingRef.current?.focus();
    }
  }, [state.status]);

  // Success state
  if (state.status === "success") {
    return (
      <div
        className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background-subtle)] p-8 flex flex-col gap-3"
        role="status"
        aria-live="polite"
      >
        <h2
          ref={successHeadingRef}
          tabIndex={-1}
          className="text-lg font-semibold text-[var(--foreground)] focus-visible:outline-none"
        >
          Message sent!
        </h2>
        <p className="text-sm text-[var(--foreground-muted)]">{state.message}</p>
        <a
          href="/contact"
          className="text-sm text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-sm self-start"
        >
          Send another message
        </a>
      </div>
    );
  }

  // Get server-side field errors (merged with client-side)
  const serverFieldErrors =
    state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      {/* Top-level error message */}
      {state.status === "error" && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-[var(--radius)] border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4 py-3"
        >
          <p className="text-sm text-[var(--destructive)]">{state.message}</p>
        </div>
      )}

      <Input
        id="contact-name"
        label="Your name"
        type="text"
        autoComplete="name"
        required
        {...register("name")}
        error={errors.name?.message ?? serverFieldErrors["name"]}
      />

      <Input
        id="contact-email"
        label="Email address"
        type="email"
        autoComplete="email"
        required
        {...register("email")}
        error={errors.email?.message ?? serverFieldErrors["email"]}
      />

      <Input
        id="contact-subject"
        label="Subject"
        type="text"
        required
        {...register("subject")}
        error={errors.subject?.message ?? serverFieldErrors["subject"]}
      />

      <Textarea
        id="contact-message"
        label="Message"
        required
        rows={6}
        {...register("message")}
        error={errors.message?.message ?? serverFieldErrors["message"]}
        helperText="Minimum 10 characters."
      />

      <SubmitButton />
    </form>
  );
}
