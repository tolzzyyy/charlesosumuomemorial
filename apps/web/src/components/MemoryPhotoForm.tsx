import { type FormEvent, useEffect, useRef, useState } from "react";
import { submitMemoryPhoto, type MemoryPhotoReceipt } from "../lib/api";

type FormState = "idle" | "submitting" | "success" | "error";

type MemoryPhotoFormProps = {
  onSubmitted?: (receipt: MemoryPhotoReceipt) => void | Promise<void>;
};

const labelClass = "mb-5 grid gap-[.55rem]";
const labelTextClass = "text-[.68rem] font-semibold uppercase tracking-[.08em] text-[#52626d]";
const inputClass =
  "w-full rounded-none border-0 border-b border-[#cbd4da] bg-white px-0 py-[.7rem] text-ink outline-none focus:border-gold";
const submitButtonClass =
  "inline-flex min-h-12 cursor-pointer items-center justify-center border border-transparent bg-[#18476f] px-[1.4rem] py-[.85rem] text-[.72rem] font-semibold uppercase tracking-[.09em] text-white transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0";

async function optimizePhoto(file: File): Promise<File> {
  if (file.type === "image/gif" || typeof createImageBitmap !== "function") return file;

  const bitmap = await createImageBitmap(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const optimizedBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", .78);
  });

  if (!optimizedBlob || optimizedBlob.size >= file.size) return file;

  const optimizedName = `${file.name.replace(/\.[^.]+$/, "") || "memory-photo"}.webp`;
  return new File([optimizedBlob], optimizedName, {
    type: "image/webp",
    lastModified: file.lastModified,
  });
}

export function MemoryPhotoForm({ onSubmitted }: MemoryPhotoFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    try {
      const formData = new FormData(event.currentTarget);
      const selectedImage = formData.get("image");

      if (selectedImage instanceof File && selectedImage.size > 0) {
        formData.set("image", await optimizePhoto(selectedImage));
      }

      const receipt = await submitMemoryPhoto(formData);
      formRef.current?.reset();
      setPreview(null);
      setState("success");
      setMessage(
        receipt.status === "approved"
          ? "Your photograph is now part of the Memory Wall."
          : "Your photograph has been sent to the family for review.",
      );
      try {
        await onSubmitted?.(receipt);
      } catch {
        // The photograph was stored successfully even if refreshing the wall fails.
      }
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The photograph could not be uploaded.");
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="bg-white p-[clamp(1.5rem,4vw,3rem)] text-ink max-sm:p-[1.4rem]"
    >
      <label className={labelClass}>
        <span className={labelTextClass}>Your name</span>
        <input className={inputClass} name="contributorName" required minLength={2} maxLength={100} autoComplete="name" />
      </label>

      <label className={labelClass}>
        <span className={labelTextClass}>
          Photo caption <small className="text-[.65rem] font-normal tracking-normal normal-case text-[#8b989f]">(optional)</small>
        </span>
        <input className={inputClass} name="caption" maxLength={240} placeholder="Where or when was this taken?" />
      </label>

      <label className={labelClass}>
        <span className={labelTextClass}>
          Choose a photograph{" "}
          <small className="text-[.65rem] font-normal tracking-normal normal-case text-[#8b989f]">(JPEG, PNG, WebP or GIF · max 8 MB)</small>
        </span>
        <input
          className="w-full border border-dashed border-[#aebcc6] bg-mist p-3 text-[.75rem] text-muted file:mr-3 file:cursor-pointer file:border-0 file:bg-navy file:px-3 file:py-2 file:text-[.68rem] file:font-semibold file:text-white file:uppercase"
          name="image"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />
      </label>

      {preview ? (
        <div className="mt-[-.3rem] mb-[1.3rem] flex items-center gap-[.8rem] text-[.72rem] text-muted">
          <img className="h-[62px] w-[62px] object-cover" src={preview} alt="Selected photograph preview" />
          <span>Photograph ready to add to the wall</span>
        </div>
      ) : null}

      <input className="absolute -left-[10000px]" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <button type="submit" className={submitButtonClass} disabled={state === "submitting"}>
        {state === "submitting" ? "Adding photograph…" : "Add to Memory Wall"}
      </button>

      {message ? (
        <p className={`mt-4 text-[.78rem] leading-normal ${state === "success" ? "text-[#266846]" : "text-[#a63030]"}`} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
