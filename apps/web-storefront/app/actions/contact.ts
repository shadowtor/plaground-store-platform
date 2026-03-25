/**
 * Contact form server action.
 *
 * Submits a contact enquiry to the API.
 * Rate limiting is enforced at the API layer (per-IP, per-email).
 *
 * Security:
 * - Input validated with Zod before submission
 * - No user-controlled data in error messages exposed to client
 * - Internal errors logged (not shown to user)
 */

"use server";

import { contactFormSchema } from "packages/contracts";

export type ContactFormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: Partial<Record<"name" | "email" | "subject" | "message", string>>;
    };

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  };

  // Validate with Zod — shared schema from packages/contracts
  const result = contactFormSchema.safeParse(raw);

  if (!result.success) {
    const fieldErrors: Partial<Record<"name" | "email" | "subject" | "message", string>> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as "name" | "email" | "subject" | "message";
      if (field && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors,
    };
  }

  const apiUrl = process.env["NEXT_PUBLIC_API_URL"];

  if (!apiUrl) {
    // Dev environment without API running — simulate success
    console.info("[Contact] API URL not configured — simulating success");
    return {
      status: "success",
      message:
        "Thanks for your message! We'll get back to you within one business day.",
    };
  }

  try {
    const res = await fetch(`${apiUrl}/api/v1/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.data),
    });

    if (res.status === 429) {
      return {
        status: "error",
        message:
          "Too many requests. Please wait a few minutes before trying again.",
      };
    }

    if (!res.ok) {
      // Log but don't expose internals to the client
      console.error("[Contact] API error:", res.status, await res.text());
      return {
        status: "error",
        message:
          "Something went wrong sending your message. Please try again or email us directly.",
      };
    }

    return {
      status: "success",
      message:
        "Thanks for your message! We'll get back to you within one business day.",
    };
  } catch (err) {
    // Network error — log and return user-safe message
    console.error("[Contact] Network error:", err);
    return {
      status: "error",
      message:
        "Unable to send your message right now. Please try again or email us directly.",
    };
  }
}
