import React from "react";

export { Button, buttonClass } from "./Button";
export type { ButtonVariant, ButtonSize, ButtonProps } from "./Button";

// Card — cp-card (surface + border + radius) with padding baked in (the class
// carries none, so call sites used to pass it inline). Pass `pad={false}` for a
// flush container.
export function Card({
  pad = true,
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { pad?: boolean }) {
  return (
    <div className={`cp-card ${pad ? "p-4 md:p-[18px]" : ""} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export type FieldSize = "sm" | "md";
const fieldSize = (s: FieldSize) => (s === "sm" ? "h-[34px] text-[12px]" : "");

// Input / Select / Textarea — the cp-input class is complete (h44, padding,
// border); these wrap it so forms stop repeating className="cp-input" and the
// occasional sm size override.
export function Input({
  size = "md",
  className = "",
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: FieldSize }) {
  return <input className={`cp-input ${fieldSize(size)} ${className}`} {...rest} />;
}

export function Select({
  size = "md",
  className = "",
  children,
  ...rest
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: FieldSize }) {
  return (
    <select className={`cp-input ${fieldSize(size)} ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({
  className = "",
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`cp-input h-auto py-2.5 ${className}`} {...rest} />;
}

// Label — cp-label (mono caption). Defaults to a <label>; pass as="div" for a
// standalone section caption.
export function Label({
  as: As = "label",
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: "label" | "div" | "span"; htmlFor?: string }) {
  return (
    <As className={`cp-label ${className}`} {...rest}>
      {children}
    </As>
  );
}

// Spinner — cp-spinner keyframe loader.
export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`cp-spinner ${className}`} />;
}

// Chip — small mono pill used for statuses, locales, roles.
export function Chip({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: "neutral" | "primary" | "ok" | "warn" | "err";
  className?: string;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral:
      "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]",
    primary:
      "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]",
    ok: "bg-[var(--cp-ok-dim,rgba(70,224,160,.14))] text-[var(--cp-ok)]",
    warn: "bg-[var(--cp-warn-dim,rgba(245,183,61,.14))] text-[var(--cp-warn)]",
    err: "bg-[var(--cp-err-dim)] text-[var(--cp-err)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-[var(--cp-mono)] text-[10.5px] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// Callout — inline banner for errors/info, replacing the repeated cp-err-dim box.
export function Callout({
  tone = "err",
  icon,
  className = "",
  children,
}: {
  tone?: "err" | "warn" | "info";
  icon?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    err: "bg-[var(--cp-err-dim)] border-[rgba(255,122,107,.22)] text-[var(--cp-err)]",
    warn: "bg-[rgba(245,183,61,.12)] border-[rgba(245,183,61,.22)] text-[var(--cp-warn)]",
    info: "bg-[var(--md-sys-color-surface-container)] border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)]",
  };
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 font-[var(--cp-mono)] text-[12.5px] ${tones[tone]} ${className}`}
    >
      {icon && <span className="msym text-[16px]">{icon}</span>}
      {children}
    </div>
  );
}
