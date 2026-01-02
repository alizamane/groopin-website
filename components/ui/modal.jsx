"use client";

import React, { useEffect } from "react";

export default function Modal({
  open,
  title,
  onClose,
  children
}) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onClick={() => onClose?.()}
    >
      <div
        className="w-full max-w-lg max-h-[calc(100dvh-3rem)] rounded-3xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {title ? (
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-primary-900">
              {title}
            </h2>
          </div>
        ) : null}
        <div className="mt-4 max-h-[calc(100dvh-12rem)] overflow-y-auto pb-6 pr-1">
          {children}
        </div>
      </div>
    </div>
  );
}
