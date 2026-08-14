import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";


export const Route = createFileRoute("/json")({
  validateSearch: z.object({ path: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "JSON Viewer — FN Asset Path Finder" },
      {
        name: "description",
        content:
          "Inspect the raw JSON export of any Fortnite game asset path directly in your browser.",
      },
      { property: "og:title", content: "JSON Viewer — FN Asset Path Finder" },
      {
        property: "og:description",
        content: "Inspect the raw JSON export of any Fortnite game asset path.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JsonViewer,
});

function JsonViewer() {
  const { path } = Route.useSearch();
  const [text, setText] = useState("Loading…");

  useEffect(() => {
    if (!path) {
      setText("No path provided.");
      return;
    }
    let cancelled = false;
    setText("Loading…");
    fetch(`/api/public/asset-json?path=${encodeURIComponent(path)}`)
      .then(async (r) => {
        const body = await r.text();
        try {
          return JSON.stringify(JSON.parse(body), null, 4);
        } catch {
          return body;
        }
      })
      .then((t) => !cancelled && setText(t))
      .catch(() => !cancelled && setText("Failed to load JSON."))
      .finally(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <h1 className="font-mono text-2xl font-bold text-primary">JSON Viewer</h1>
      <p className="mt-2 break-all font-mono text-sm leading-snug text-muted-foreground">
        {path ?? "—"}
      </p>
      <pre className="mt-5 overflow-auto rounded-2xl border border-border bg-card p-4 font-mono text-[13px] leading-relaxed text-foreground/90">
        {text}
      </pre>
    </div>
  );
}
