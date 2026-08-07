import { createFileRoute } from "@tanstack/react-router";

const COSMETIC_ID =
  /(cid|bid|eid|glider|pickaxe|wrap|musicpack|loadingscreen|trails)_[a-z0-9_]+/gi;

function thumbnailCandidates(assetPath: string) {
  const cleanPath = assetPath.split(".")[0] ?? assetPath;
  const segments = cleanPath.split("/").filter(Boolean);
  const ids: string[] = [];

  for (const segment of segments) {
    ids.push(segment);
    for (const match of segment.matchAll(COSMETIC_ID)) {
      if (match[0]) ids.push(match[0]);
    }
  }

  for (const value of [...ids]) {
    const parts = value.split("_");
    while (parts.length > 3) {
      parts.pop();
      ids.push(parts.join("_"));
    }
  }

  return [...new Set(ids.filter(Boolean).map((id) => id.toLowerCase()))].flatMap(
    (id) => [
      `https://fortnite-api.com/images/cosmetics/br/${encodeURIComponent(id)}/smallicon.png`,
      `https://fortnite-api.com/images/cosmetics/br/${encodeURIComponent(id)}/icon.png`,
    ],
  );
}

export const Route = createFileRoute("/api/public/asset-thumbnail")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const assetPath = new URL(request.url).searchParams.get("path")?.slice(0, 500);
        if (!assetPath) return new Response("Missing path", { status: 400 });

        for (const url of thumbnailCandidates(assetPath)) {
          try {
            const image = await fetch(url, {
              headers: { accept: "image/png,image/*" },
            });
            if (!image.ok || !image.body) continue;

            return new Response(image.body, {
              headers: {
                "content-type": image.headers.get("content-type") ?? "image/png",
                "cache-control": "public, max-age=86400, s-maxage=604800",
              },
            });
          } catch {
            // Try the next candidate when the image host is temporarily unavailable.
          }
        }

        return new Response("Thumbnail unavailable", {
          status: 404,
          headers: { "cache-control": "public, max-age=3600" },
        });
      },
    },
  },
});