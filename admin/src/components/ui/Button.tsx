import React from "react";

// Button — the one place button sizing lives. The cp-btn-* classes are pill
// shaped (border-radius:9999px) but carry NO padding/height, so every call site
// used to hand-pass inline styles (and forget them → blobs). This bakes them in.

export type ButtonVariant = "primary" | "tonal" | "ghost" | "soft";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "cp-btn-primary",
  tonal: "cp-btn-tonal",
  ghost: "cp-btn-ghost",
  soft: "cp-btn-soft",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-[34px] px-4 text-[12px]",
  md: "h-[38px] px-[18px] text-[12.5px]",
  lg: "h-[42px] px-5 text-[13px]",
};

const ICON_SIZE: Record<ButtonSize, string> = {
  sm: "text-[16px]",
  md: "text-[18px]",
  lg: "text-[18px]",
};

// buttonClass exposes the same styling for elements that can't be a <button>
// (e.g. a Next <Link> rendered as a button).
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra = ""
): string {
  return `${VARIANT[variant]} ${SIZE[size]} ${extra}`.trim();
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Material Symbols glyph name rendered before the label. */
  icon?: string;
  /** Render the label danger-colored (mainly for ghost delete actions). */
  danger?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  danger,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={buttonClass(
        variant,
        size,
        `${danger ? "text-[var(--cp-err)]" : ""} ${className}`
      )}
      {...rest}
    >
      {icon && <span className={`msym ${ICON_SIZE[size]}`}>{icon}</span>}
      {children}
    </button>
  );
}
