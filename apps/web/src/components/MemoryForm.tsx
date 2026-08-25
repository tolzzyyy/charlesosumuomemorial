import { type FormEvent, useRef, useState } from "react";
import { submitTribute, type TributeReceipt } from "../lib/api";

type FormState = "idle" | "submitting" | "success" | "error";

type MemoryFormProps = {
  onSubmitted?: (receipt: TributeReceipt) => void | Promise<void>;
};

const labelClass = "mb-5 grid gap-[.55rem]";
const labelTextClass = "text-[.68rem] font-semibold uppercase tracking-[.08em] text-[#52626d]";
const inputClass =
  "w-full rounded-none border-0 border-b border-[#cbd4da] bg-white px-0 py-[.7rem] text-ink outline-none focus:border-gold";
const submitButtonClass =
  "inline-flex min-h-12 cursor-pointer items-center justify-center border border-transparent bg-[#18476f] px-[1.4rem] py-[.85rem] text-[.72rem] font-semibold uppercase tracking-[.09em] text-white transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0";

export function MemoryForm({ onSubmitted }: MemoryFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    try {
      const formData = new FormData(event.currentTarget);
      const receipt = await submitTribute({
        name: String(formData.get("name") ?? ""),
        relationship: String(formData.get("relationship") ?? ""),
        email: String(formData.get("email") ?? ""),
        message: String(formData.get("message") ?? ""),
        website: String(formData.get("website") ?? ""),
      });
      formRef.current?.reset();
      setState("success");
      setMessage(
        receipt.status === "approved"
          ? "Your testimonial is now live in the Testimonials section."
          : "Thank you. Your testimonial has been sent to the family for review.",
      );
      try {
        await onSubmitted?.(receipt);
      } catch {
        // The testimonial was stored successfully even if refreshing the wall fails.
      }
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Your testimonial could not be sent.");
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="bg-white p-[clamp(1.5rem,4vw,3rem)] text-ink max-sm:p-[1.4rem]"
    >
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1 max-sm:gap-0">
        <label className={labelClass}>
          <span className={labelTextClass}>Your name</span>
          <input className={inputClass} name="name" required minLength={2} maxLength={100} autoComplete="name" />
        </label>
        <label className={labelClass}>
          <span className={labelTextClass}>Relationship to Chief Charles</span>
          <input className={inputClass} name="relationship" required minLength={2} maxLength={100} />
        </label>
      </div>

      <label className={labelClass}>
        <span className={labelTextClass}>
          Email <small className="text-[.65rem] font-normal tracking-normal normal-case text-[#8b989f]">(kept private)</small>
        </span>
        <input className={inputClass} name="email" type="email" autoComplete="email" />
      </label>

      <label className={labelClass}>
        <span className={labelTextClass}>Your testimonial</span>
        <textarea className={`${inputClass} resize-y`} name="message" required minLength={10} maxLength={3000} rows={5} />
      </label>

      <input className="absolute -left-[10000px]" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <button type="submit" className={submitButtonClass} disabled={state === "submitting"}>
        {state === "submitting" ? "Publishing testimonial…" : "Publish testimonial"}
      </button>

      {message ? (
        <p className={`mt-4 text-[.78rem] leading-normal ${state === "success" ? "text-[#266846]" : "text-[#a63030]"}`} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
