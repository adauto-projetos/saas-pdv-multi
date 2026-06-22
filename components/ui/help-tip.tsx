"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { useHelp } from "@/lib/help/help-context";

/* ── Shared dialog ───────────────────────────────────────────── */
function HelpDialog({
  title,
  content,
  onClose,
}: {
  title: string;
  content: string;
  onClose: () => void;
}) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,.45)",
          zIndex: 9998,
        }}
        onClick={onClose}
      />
      {/* Card */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "#fff",
          borderRadius: 20,
          padding: "28px 28px 24px",
          maxWidth: 440,
          width: "92vw",
          zIndex: 9999,
          boxShadow: "0 24px 60px rgba(0,0,0,.22)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "#eef2ff",
                color: "#4f46e5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 17,
              }}
            >
              ?
            </div>
            <span
              style={{
                fontFamily: "var(--font-jakarta)",
                fontWeight: 800,
                fontSize: 17,
                color: "#0f172a",
              }}
            >
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#f1f5f9",
              border: "none",
              borderRadius: 8,
              width: 30,
              height: 30,
              cursor: "pointer",
              fontSize: 18,
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {/* Content */}
        <p
          style={{
            fontSize: 14.5,
            lineHeight: 1.8,
            color: "#475569",
            margin: 0,
            whiteSpace: "pre-line",
          }}
        >
          {content}
        </p>
      </div>
    </>
  );
}

/* ── HelpTip: wraps any element ──────────────────────────────── */
interface HelpTipProps {
  text: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  placement?: "top" | "bottom";
  detail?: string;
  dialogTitle?: string;
}

export function HelpTip({
  text,
  children,
  style,
  placement = "top",
  detail,
  dialogTitle,
}: HelpTipProps) {
  const { helpActive } = useHelp();
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  function handleEnter() {
    if (!helpActive) return;
    setRect(ref.current?.getBoundingClientRect() ?? null);
  }
  function handleLeave() {
    setRect(null);
  }

  return (
    <div
      ref={ref}
      style={{ position: "relative", ...style }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}

      {/* ? badge — opens dialog */}
      {helpActive && detail && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setDialogOpen(true);
          }}
          onMouseEnter={(e) => e.stopPropagation()}
          title="Clique para saber mais"
          style={{
            position: "absolute",
            top: -7,
            right: -7,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#4f46e5",
            color: "#fff",
            border: "2px solid #fff",
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            boxShadow: "0 1px 4px rgba(79,70,229,.4)",
            lineHeight: 1,
          }}
        >
          ?
        </button>
      )}

      {/* Tooltip */}
      {helpActive && rect && !dialogOpen &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: rect.left + rect.width / 2,
              ...(placement === "top"
                ? {
                    top: rect.top - 8,
                    transform: "translateX(-50%) translateY(-100%)",
                  }
                : { top: rect.bottom + 8, transform: "translateX(-50%)" }),
              background: "#0f172a",
              color: "#f8fafc",
              fontSize: 12,
              fontWeight: 600,
              padding: "8px 13px",
              borderRadius: 9,
              maxWidth: 270,
              textAlign: "center",
              lineHeight: 1.55,
              zIndex: 9997,
              pointerEvents: "none",
              boxShadow: "0 4px 20px rgba(0,0,0,.28)",
              whiteSpace: "normal",
            }}
          >
            {text}
            {detail && (
              <div style={{ fontSize: 10, color: "#a5b4fc", marginTop: 4 }}>
                Clique em ? para saber mais
              </div>
            )}
            <div
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                ...(placement === "top"
                  ? {
                      top: "100%",
                      borderLeft: "5px solid transparent",
                      borderRight: "5px solid transparent",
                      borderTop: "5px solid #0f172a",
                    }
                  : {
                      bottom: "100%",
                      borderLeft: "5px solid transparent",
                      borderRight: "5px solid transparent",
                      borderBottom: "5px solid #0f172a",
                    }),
              }}
            />
          </div>,
          document.body,
        )}

      {/* Dialog */}
      {dialogOpen &&
        createPortal(
          <HelpDialog
            title={dialogTitle ?? text}
            content={detail ?? ""}
            onClose={() => setDialogOpen(false)}
          />,
          document.body,
        )}
    </div>
  );
}

/* ── InfoButton: standalone ? icon next to labels ────────────── */
export function InfoButton({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  const { helpActive } = useHelp();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  if (!helpActive) return null;

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        title={`Ajuda: ${title}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 15,
          height: 15,
          borderRadius: "50%",
          background: "#818cf8",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontSize: 9,
          fontWeight: 900,
          verticalAlign: "middle",
          marginLeft: 5,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ?
      </button>
      {dialogOpen &&
        createPortal(
          <HelpDialog
            title={title}
            content={detail}
            onClose={() => setDialogOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}
