import { createFileRoute } from "@tanstack/react-router";

const COSMETIC_ID =
  /(cid|bid|eid|glider|pickaxe|wrap|musicpack|loadingscreen|trails|petcarrier|spid|emoji|banner)_[a-z0-9_]+/gi;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

/** Candidate cosmetic IDs derived from an asset path, best guess first. */
function candidateIds(assetPath: string) {
  const cleanPath = assetPath.split(".")[0] ?? assetPath;
  const segments = cleanPath.split("/").filter(Boolean);
  const ids: string[] = [];

  for (const segment of segments.reverse()) {
    for (const match of segment.matchAll(COSMETIC_ID)) {
      if (match[0]) ids.push(match[0]);
    }
    ids.push(segment);
  }

  for (const value of [...ids]) {
    const parts = value.split("_");
    while (parts.length > 3) {
      parts.pop();
      ids.push(parts.join("_"));
    }
  }

  return [...new Set(ids.filter((id) => id.length > 2))].slice(0, 8);
}

type CosmeticImages = {
  smallIcon?: string | null;
  icon?: string | null;
  featured?: string | null;
  other?: Record<string, string> | null;
};

function pickImage(images: CosmeticImages | undefined | null) {
  if (!images) return null;
  return (
    images.icon ??
    images.smallIcon ??
    images.featured ??
    (images.other ? Object.values(images.other)[0] : null) ??
    null
  );
}

/** Ask the cosmetics JSON API for the real image URL of a cosmetic id. */
async function imageUrlFromJson(id: string) {
  const endpoints = [
    `https://fortnite-api.com/v2/cosmetics/br/search?id=${encodeURIComponent(id)}`,
    `https://fortnite-api.com/v2/cosmetics/search?id=${encodeURIComponent(id)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        headers: { accept: "application/json", "user-agent": UA },
      });
      if (!res.ok) continue;
      const body = (await res.json()) as {
        data?: { images?: CosmeticImages } | { images?: CosmeticImages }[];
      };
      const entry = Array.isArray(body.data) ? body.data[0] : body.data;
      const url = pickImage(entry?.images);
      if (url) return url;
    } catch {
      // Fall through to the next endpoint / candidate.
    }
  }
  return null;
}

async function streamImage(url: string) {
  try {
    const image = await fetch(url, {
      headers: { accept: "image/png,image/*", "user-agent": UA },
    });
    const type = image.headers.get("content-type") ?? "";
    if (!image.ok || !image.body || !type.startsWith("image/")) return null;
    return new Response(image.body, {
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch {
    return null;
  }
}

/** Generic naming noise found in mesh/material asset names. */
const NOISE = new Set([
  "cid","bid","eid","sk","sm","cp","mesh","meshes","body","bodies","head","heads","parts",
  "athena","commando","male","female","med","lrg","sml","skeleton","mat","matda","lod",
  "base","mi","tex","texture","material","default","new","old","test","proto","game",
  "content","fortnitegame","characters","cosmetics","items","backpacks","assets","render",
]);

/** Distinctive name tokens (e.g. "PinkBear") for a contains-search fallback. */
function searchTokens(assetPath: string) {
  const file = (assetPath.split("/").pop() ?? assetPath).split(".")[0] ?? "";
  const tokens = file
    .split(/[_\-\s]+/)
    .filter((t) => t.length > 3 && !NOISE.has(t.toLowerCase()) && !/^\d+$/.test(t));
  return [...new Set(tokens)].sort((a, b) => b.length - a.length).slice(0, 3);
}

/** Look up a cosmetic whose id merely contains the token. */
async function imageUrlFromToken(token: string) {
  try {
    const res = await fetch(
      `https://fortnite-api.com/v2/cosmetics/br/search?id=${encodeURIComponent(
        token,
      )}&matchMethod=contains`,
      { headers: { accept: "application/json", "user-agent": UA } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { images?: CosmeticImages } };
    return pickImage(body.data?.images);
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/asset-thumbnail")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const assetPath = new URL(request.url).searchParams.get("path")?.slice(0, 500);
        if (!assetPath) return new Response("Missing path", { status: 400 });

        const ids = candidateIds(assetPath);

        // 1) Resolve through the cosmetics JSON metadata (most reliable).
        for (const id of ids) {
          const url = await imageUrlFromJson(id);
          if (url) {
            const response = await streamImage(url);
            if (response) return response;
          }
        }

        // 2) Fall back to guessing the CDN image paths directly.
        for (const id of ids) {
          const slug = encodeURIComponent(id.toLowerCase());
          for (const variant of ["smallicon", "icon"]) {
            const response = await streamImage(
              `https://fortnite-api.com/images/cosmetics/br/${slug}/${variant}.png`,
            );
            if (response) return response;
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
