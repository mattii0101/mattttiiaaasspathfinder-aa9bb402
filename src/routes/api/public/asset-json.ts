import { createFileRoute } from "@tanstack/react-router";

const DILLY = "https://export-service-new.dillyapis.com/v1/export";
const UA = "Mozilla/5.0 (compatible; PathfinderBot/1.0)";

function variants(input: string) {
  const raw = input.replace(/\.uasset$/i, "");
  const out: string[] = [];

  const push = (p: string) => {
    if (p && !out.includes(p)) out.push(p);
  };

  push(raw);

  // Strip the trailing ".ObjectName" duplicate segment.
  const lastSlash = raw.lastIndexOf("/");
  const tail = raw.slice(lastSlash + 1);
  const dot = tail.indexOf(".");
  const base = dot === -1 ? raw : raw.slice(0, lastSlash + 1) + tail.slice(0, dot);
  push(base);
  push(`${base}.${base.slice(base.lastIndexOf("/") + 1)}`);

  // FortniteGame/Content <-> /Game
  if (base.startsWith("/Game/")) {
    push(base.replace("/Game/", "FortniteGame/Content/"));
  } else if (base.startsWith("FortniteGame/Content/")) {
    push(base.replace("FortniteGame/Content/", "/Game/"));
  } else if (!base.startsWith("/")) {
    push(`/${base}`);
  }

  return out.slice(0, 6);
}

export const Route = createFileRoute("/api/public/asset-json")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const path = new URL(request.url).searchParams.get("path")?.slice(0, 500);
        if (!path) return new Response("Missing path", { status: 400 });

        let lastStatus = 404;
        for (const candidate of variants(path)) {
          try {
            const res = await fetch(
              `${DILLY}?path=${encodeURIComponent(candidate)}&raw=false`,
              { headers: { accept: "application/json", "user-agent": UA } },
            );
            lastStatus = res.status;
            if (res.ok) {
              const body = await res.text();
              if (!body.includes('"not_found"')) {
                return new Response(body, {
                  headers: {
                    "content-type": "application/json; charset=utf-8",
                    "cache-control": "public, max-age=3600",
                  },
                });
              }
            }
          } catch {
            // try next variant
          }
        }

        return new Response(
          JSON.stringify(
            {
              error: "Asset not available in the current Fortnite build",
              path,
              tried: variants(path),
              hint: "This path exists in the index but was removed or renamed by Epic, so the export service has nothing to return.",
              upstreamStatus: lastStatus,
            },
            null,
            2,
          ),
          {
            status: 404,
            headers: { "content-type": "application/json; charset=utf-8" },
          },
        );
      },
    },
  },
});
