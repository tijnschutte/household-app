"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { withTrailingBlank } from "@/src/lib/recepten/recipe-form-lines";

/**
 * The method as numbered rows, one textarea per step. Enter opens the next
 * step and moves the caret there; Backspace on an empty step removes it and
 * moves back. The last row is always blank — it is where the next step gets
 * typed, and the schema drops it when it stays empty.
 */
export default function StepEditor({
  steps,
  onChange,
  disabled,
}: {
  steps: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
}) {
  const rowRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  // A stable key per row, so React keeps each textarea with its own step when
  // one is inserted or removed above it.
  const nextIdRef = useRef(steps.length);
  const [ids, setIds] = useState<number[]>(() => steps.map((_, i) => i));

  /** ids and steps must stay the same length; the trailing-blank rule can change either. */
  const commit = (nextSteps: string[], nextIds: number[]) => {
    const aligned = withTrailingBlank(nextSteps);
    const alignedIds = nextIds.slice(0, aligned.length);
    while (alignedIds.length < aligned.length) alignedIds.push(nextIdRef.current++);
    setIds(alignedIds);
    onChange(aligned);
  };

  const focusRow = (index: number) => {
    const row = rowRefs.current[index];
    row?.focus();
    row?.setSelectionRange(row.value.length, row.value.length);
  };

  const setStep = (index: number, text: string) => {
    commit(
      steps.map((step, i) => (i === index ? text : step)),
      ids
    );
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (steps[index].trim() === "") return;
      commit(
        [...steps.slice(0, index + 1), "", ...steps.slice(index + 1)],
        [...ids.slice(0, index + 1), nextIdRef.current++, ...ids.slice(index + 1)]
      );
      // A key press is a discrete event, so React has committed the new row by
      // the time this runs; the row itself does not exist yet while handling.
      queueMicrotask(() => focusRow(index + 1));
    }
    if (e.key === "Backspace" && steps[index] === "" && index > 0) {
      e.preventDefault();
      focusRow(index - 1);
      commit(
        steps.filter((_, i) => i !== index),
        ids.filter((_, i) => i !== index)
      );
    }
  };

  return (
    <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {steps.map((step, index) => (
        <li key={ids[index]} className="flex items-start gap-3 px-3.5 py-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[13px] font-semibold text-primary">
            {index + 1}
          </span>
          <textarea
            ref={(el) => {
              rowRefs.current[index] = el;
            }}
            value={step}
            onChange={(e) => setStep(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            rows={1}
            disabled={disabled}
            placeholder={index === steps.length - 1 ? "Volgende stap…" : ""}
            aria-label={`Stap ${index + 1}`}
            className="min-h-7 flex-1 resize-none bg-transparent pt-0.5 text-[15px] leading-relaxed outline-none placeholder:text-gray-400 [field-sizing:content]"
          />
        </li>
      ))}
    </ol>
  );
}
