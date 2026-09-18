import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/livedbg")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q") ?? "AI";
        const s = await import("@/lib/live-sources.server");
        const w = await import("@/lib/live-sources-world.server");
        const e = await import("@/lib/live-sources-extra.server");
        const run = async (name: string, p: Promise<unknown[]>) => {
          const t = Date.now();
          try {
            const rows = (await p) as unknown[];
            return { name, ms: Date.now() - t, n: rows.length };
          } catch (err) {
            return { name, ms: Date.now() - t, err: String(err).slice(0, 200) };
          }
        };
        const out = await Promise.all([
          run("hn", s.hackerNewsSearch(q, { ms: 9000 })),
          run("lobsters", w.lobsters({ ms: 9000 })),
          run("gnewsTop", s.googleNewsTop({ country: "EG", ms: 9000 })),
          run("gnews", s.googleNewsSearch(q, { country: "EG", ms: 9000 })),
          run("arabic", e.arabicFeeds({ ms: 9000 })),
          run("gdelt", s.gdeltNews(q, { ms: 9000 })),
          run("duck", s.duckSearch(q, { ms: 9000 })),
        ]);
        return new Response(JSON.stringify(out, null, 2), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
