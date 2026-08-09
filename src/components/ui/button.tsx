"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const baseClasses =
  "inline-flex items-center justify-center min-h-12 px-6 gap-2 rounded-md text-sm font-semibold outline-none " +
  "focus-visible:outline focus-visible:outline-[length:var(--focus-ring-width)] " +
  "focus-visible:outline-offset-[var(--focus-ring-offset)] focus-visible:outline-[color:var(--color-border-focus)]";

const variantBaseClasses: Record<ButtonVariant, string> = {
  primary: "bg-action-primary-background text-action-primary-foreground",
  secondary:
    "border border-border-strong bg-action-secondary-background text-action-secondary-foreground",
  ghost: "bg-action-ghost-background text-action-ghost-foreground",
  destructive: "bg-action-destructive-background text-action-destructive-foreground",
};

const variantInteractiveClasses: Record<ButtonVariant, string> = {
  primary: "hover:bg-action-primary-hover active:bg-action-primary-active",
  secondary: "hover:bg-action-secondary-hover active:bg-action-secondary-active",
  ghost: "hover:bg-action-ghost-hover active:bg-action-ghost-active",
  destructive: "hover:bg-action-destructive-hover active:bg-action-destructive-active",
};

const inactiveClasses = "cursor-not-allowed opacity-[var(--action-disabled-opacity)]";

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  type = "button",
  className,
  onClick,
  "aria-disabled": ariaDisabledProp,
  "aria-busy": ariaBusyProp,
  children,
  ...rest
}: ButtonProps) {
  const isInactive = Boolean(disabled || loading);

  // Loading takes over aria-disabled/aria-busy entirely; native `disabled`
  // (when also set) is authoritative, so a redundant aria-disabled is omitted.
  const ariaDisabled = loading ? (disabled ? undefined : true) : ariaDisabledProp;
  const ariaBusy = loading ? true : ariaBusyProp;

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (loading) {
      // The same click event covers pointer activation, Enter/Space
      // activation, and a submit button's default form-submission action.
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-disabled={ariaDisabled}
      aria-busy={ariaBusy}
      className={cn(
        baseClasses,
        variantBaseClasses[variant],
        !isInactive && variantInteractiveClasses[variant],
        isInactive && inactiveClasses,
        className,
      )}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}
