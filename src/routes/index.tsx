import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FN Asset Path Finder — Search Fortnite Asset Paths" },
      {
        name: "description",
        content:
          "Search millions of Fortnite game asset paths by keyword, format them for UEFN, and copy or inspect the JSON export instantly.",
      },
      { property: "og:title", content: "FN Asset Path Finder" },
      {
        property: "og:description",
        content:
          "Search Fortnite asset paths by keyword, format them for UEFN, copy or view raw JSON.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const ASSETS_URL =
  "https://th3dryz69.github.io/FortniteToolsWeb/public/data/fortnite_assets.gz";
const PAGE_SIZE = 200;

function formatAssetPath(assetPath: string, addC: boolean) {
  let p = assetPath;
  if (p.startsWith("FortniteGame/Content")) {
    p = p.replace("FortniteGame/Content", "/Game").replace(".uasset", "");
  } else {
    const match = p.match(/\/([^/]+)\/Content\/(.+)/);
    if (match) p = `/${match[1]}/${(match[2] ?? "").replace(".uasset", "")}`;
  }
  const last = p.substring(p.lastIndexOf("/") + 1);
  p += `.${last}`;
  if (addC) p += "_C";
  return p;
}

type Status = "idle" | "loading" | "ready" | "error";

function previewUrl(apiPath: string) {
  return `https://fortnitecentral.genxgames.gg/api/v1/export?path=${encodeURIComponent(
    apiPath,
  )}&raw=true`;
}

function AssetThumb({ apiPath }: { apiPath: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted/40">
      {failed ? (
        <span className="text-[10px] font-semibold text-muted-foreground">N/A</span>
      ) : (
        <img
          src={previewUrl(apiPath)}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-contain"
        />
      )}
    </span>
  );
}

function Index() {
  const [status, setStatus] = useState<Status>("idle");
  const [count, setCount] = useState(0);
  const assetsRef = useRef<string[]>([]);

  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [formatted, setFormatted] = useState(false);
  const [addC, setAddC] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      try {
        const res = await fetch(ASSETS_URL);
        if (!res.ok) throw new Error(String(res.status));
        const buffer = await res.arrayBuffer();
        const stream = new Blob([buffer])
          .stream()
          .pipeThrough(new DecompressionStream("gzip"));
        const text = await new Response(stream).text();
        if (cancelled) return;
        assetsRef.current = text.split("\n").filter(Boolean);
        setCount(assetsRef.current.length);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    const kws = submitted.toLowerCase().split(/[\s,]+/).filter(Boolean);
    if (!kws.length || status !== "ready") return [];
    return assetsRef.current.filter((p) => {
      const lower = p.toLowerCase();
      return kws.every((kw) => lower.includes(kw));
    });
  }, [submitted, status]);

  const shown = results.slice(0, limit);

  function search() {
    setLimit(PAGE_SIZE);
    setSubmitted(query.trim());
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied((c) => (c === text ? null : c)), 1500);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-primary font-black text-primary-foreground">
              FN
            </span>
            <div>
              <h1 className="text-base font-bold tracking-tight">Asset Path Finder</h1>
              <p className="text-xs text-muted-foreground">
                {status === "ready"
                  ? `${count.toLocaleString()} paths indexed`
                  : status === "loading"
                    ? "Loading asset index…"
                    : status === "error"
                      ? "Index failed to load"
                      : "Starting…"}
              </p>
            </div>
          </div>
          <span
            className={`size-2.5 rounded-full ${
              status === "ready"
                ? "bg-accent"
                : status === "error"
                  ? "bg-destructive"
                  : "animate-pulse bg-muted-foreground"
            }`}
            aria-hidden
          />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-lg shadow-black/20">
          <label
            htmlFor="keywords"
            className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            Assets
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id="keywords"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Keywords separated by spaces or commas"
              autoComplete="off"
              className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={search}
              disabled={status !== "ready"}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
            >
              {status === "loading" ? "Loading…" : "Search"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-5 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={formatted}
                onChange={(e) => setFormatted(e.target.checked)}
                className="size-4 accent-primary"
              />
              Formatted
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={addC}
                onChange={(e) => setAddC(e.target.checked)}
                className="size-4 accent-primary"
              />
              Add _C
            </label>
          </div>
        </section>

        {status === "error" && (
          <p className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Could not load the asset index. Try refreshing the page.
          </p>
        )}

        {submitted && status === "ready" && (
          <p className="mt-6 text-sm text-muted-foreground">
            <span className="font-bold text-primary">
              {results.length.toLocaleString()}
            </span>{" "}
            result{results.length === 1 ? "" : "s"} found
          </p>
        )}

        {shown.length > 0 && (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {shown.map((raw, i) => {
              const display = formatted ? formatAssetPath(raw, addC) : raw;
              const apiPath = display.endsWith("_C") ? display.slice(0, -2) : display;
              return (
                <li
                  key={`${raw}-${i}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/50"
                >
                  <span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate font-mono text-xs sm:text-sm" title={display}>
                    {display}
                  </span>
                  <a
                    href={`https://fortnitecentral.genxgames.gg/api/v1/export?path=${encodeURIComponent(apiPath)}&raw=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                  >
                    JSON
                  </a>
                  <button
                    onClick={() => void copy(display)}
                    className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                  >
                    {copied === display ? "Copied" : "Copy"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {results.length > shown.length && (
          <button
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
            className="mx-auto mt-5 block rounded-xl border border-border px-5 py-2.5 text-sm font-medium transition hover:border-primary hover:text-primary"
          >
            Load more ({(results.length - shown.length).toLocaleString()} left)
          </button>
        )}

        {submitted && status === "ready" && results.length === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">
            No asset paths match those keywords.
          </p>
        )}
      </main>
    </div>
  );
}
