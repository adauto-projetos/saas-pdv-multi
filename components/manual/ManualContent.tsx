"use client";

import * as React from "react";

import { MANUAL_SECTIONS, type ManualBlock, type ManualSection } from "./manual-data";

/* ── Blocos ──────────────────────────────────────────────────── */
function Block({ block }: { block: ManualBlock }) {
  if (block.kind === "p") {
    return (
      <p className="text-[14.5px] leading-7 text-slate-600 m-0">{block.text}</p>
    );
  }

  if (block.kind === "steps") {
    return (
      <div>
        {block.title && (
          <div className="text-[13px] font-extrabold text-slate-800 mb-2">
            {block.title}
          </div>
        )}
        <ol className="m-0 pl-0 flex flex-col gap-2 list-none">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 items-start">
              <span
                className="flex items-center justify-center shrink-0 rounded-full text-white text-[11px] font-extrabold"
                style={{ width: 20, height: 20, background: "#4f46e5" }}
              >
                {i + 1}
              </span>
              <span className="text-[14px] leading-6 text-slate-600">{item}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (block.kind === "fields") {
    return (
      <div>
        {block.title && (
          <div className="text-[13px] font-extrabold text-slate-800 mb-2">
            {block.title}
          </div>
        )}
        <div className="flex flex-col gap-2">
          {block.items.map((item, i) => (
            <div
              key={i}
              className="rounded-xl px-3.5 py-2.5"
              style={{ background: "#f8fafc", border: "1px solid #eef1f5" }}
            >
              <div className="text-[13px] font-bold text-slate-800">
                {item.label}
              </div>
              <div className="text-[13px] leading-5 text-slate-500 mt-0.5">
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // tips / rules
  const accent = block.kind === "rules" ? "#d97706" : "#0d9488";
  return (
    <div>
      {block.title && (
        <div className="text-[13px] font-extrabold text-slate-800 mb-2">
          {block.title}
        </div>
      )}
      <ul className="m-0 pl-0 flex flex-col gap-1.5 list-none">
        {block.items.map((item, i) => (
          <li key={i} className="flex gap-2.5 items-start">
            <span
              className="shrink-0 rounded-full mt-2"
              style={{ width: 6, height: 6, background: accent }}
            />
            <span className="text-[14px] leading-6 text-slate-600">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Seção ───────────────────────────────────────────────────── */
function Section({ section }: { section: ManualSection }) {
  return (
    <section
      id={section.id}
      className="scroll-mt-6 bg-white overflow-hidden"
      style={{
        border: "1px solid #eef1f5",
        borderRadius: 18,
        boxShadow: "0 1px 2px rgba(16,24,40,.04)",
      }}
    >
      <div className="px-5 md:px-6 pt-5 pb-4 border-b border-gray-100 flex items-start gap-3">
        <span
          className="flex items-center justify-center shrink-0 rounded-xl text-[20px]"
          style={{ width: 42, height: 42, background: "#eef2ff" }}
        >
          {section.icon}
        </span>
        <div>
          <h2
            className="m-0 text-[18px] text-slate-900"
            style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800 }}
          >
            {section.title}
          </h2>
          <p className="m-0 mt-0.5 text-[13px] text-slate-400">{section.summary}</p>
        </div>
      </div>
      <div className="px-5 md:px-6 py-5 flex flex-col gap-5">
        {section.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </section>
  );
}

/* ── Conteúdo principal ──────────────────────────────────────── */
export function ManualContent() {
  const [query, setQuery] = React.useState("");

  const q = query.trim().toLowerCase();
  const sections = React.useMemo(() => {
    if (!q) return MANUAL_SECTIONS;
    return MANUAL_SECTIONS.filter((s) => {
      const haystack = [
        s.title,
        s.summary,
        ...s.blocks.flatMap((b) =>
          b.kind === "p"
            ? [b.text]
            : b.kind === "fields"
              ? [b.title ?? "", ...b.items.flatMap((it) => [it.label, it.desc])]
              : [b.title ?? "", ...b.items],
        ),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [q]);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Índice */}
      <aside className="w-full lg:w-60 shrink-0 lg:sticky lg:top-6">
        <div
          className="bg-white p-3"
          style={{ border: "1px solid #eef1f5", borderRadius: 16 }}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no manual…"
            className="w-full text-[13px] outline-none mb-2"
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "8px 11px",
              background: "#f8fafc",
            }}
          />
          <nav className="flex flex-col gap-0.5 max-h-[60vh] overflow-y-auto">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className="flex items-center gap-2 text-left rounded-lg px-2.5 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                <span className="text-[15px]">{s.icon}</span>
                <span>{s.title}</span>
              </button>
            ))}
            {sections.length === 0 && (
              <p className="text-[13px] text-slate-400 px-2.5 py-2">
                Nada encontrado para “{query}”.
              </p>
            )}
          </nav>
        </div>
      </aside>

      {/* Seções */}
      <div className="flex-1 min-w-0 flex flex-col gap-5">
        {sections.map((s) => (
          <Section key={s.id} section={s} />
        ))}
        {sections.length === 0 && (
          <p className="text-sm text-slate-400">
            Nenhuma seção corresponde à sua busca.
          </p>
        )}
      </div>
    </div>
  );
}
