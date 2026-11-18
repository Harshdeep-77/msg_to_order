"use client";

import { useFormStatus } from "react-dom";

export default function MarkDoneButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
    >
      {pending ? "Sending…" : "Mark done"}
    </button>
  );
}
