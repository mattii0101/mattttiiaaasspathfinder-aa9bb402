import { createFileRoute } from "@tanstack/react-router";

const DISCORD_DOMAIN_VERIFICATION =
  "dh=107b26aed3ed2bea9776843368f0046b899b6d57";

export const Route = createFileRoute("/.well-known/discord")({
  server: {
    handlers: {
      GET: () =>
        new Response(DISCORD_DOMAIN_VERIFICATION, {
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
    },
  },
});
