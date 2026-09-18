import { createFileRoute } from "@tanstack/react-router";

// مسار اختبار مؤقت للقدرات وعقل/صوت العلامة — محمي بمفتاح ثابت ويُحذف بعد الاختبار.
const GUARD = "megsy-skilltest-2026";

export const Route = createFileRoute("/api/public/skilltest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-skilltest") !== GUARD)
          return new Response("no", { status: 401 });
        const body = (await request.json()) as {
          kind?: "skill" | "voice" | "profile";
          workspaceId: string;
          employeeId?: string;
          skillId?: string;
          url?: string;
          values?: Record<string, string>;
        };
        const started = Date.now();
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          if (body.kind === "voice") {
            const { collectSiteText, analyzeStyle, synthesizeVoice, voiceRuleText } = await import(
              "@/lib/brand-voice.server"
            );
            const site = await collectSiteText(body.url!);
            const text = [site.text, site.headings.join("\n"), site.taglines.join("\n")]
              .filter(Boolean)
              .join("\n\n");
            const stats = analyzeStyle(text, site.taglines);
            const profile = await synthesizeVoice(
              { name: "اختبار", industry: "عام" },
              stats,
              text,
              site.headings,
            );
            const rule = voiceRuleText(profile, stats);
            return Response.json({
              ok: true,
              ms: Date.now() - started,
              urls: site.urls,
              words: text.split(/\s+/).filter(Boolean).length,
              stats,
              profile,
              ruleHead: rule.slice(0, 1200),
            });
          }

          if (body.kind === "profile") {
            const { profileWebsite } = await import("@/lib/business-profile.server");
            const profile = await profileWebsite(body.url!);
            return Response.json({ ok: true, ms: Date.now() - started, profile });
          }

          const { executeSkill } = await import("@/lib/nour-run.server");
          const run = await executeSkill(supabaseAdmin, {
            workspaceId: body.workspaceId,
            employeeId: body.employeeId!,
            skillId: body.skillId!,
            values: body.values ?? {},
            origin: "اختبار",
          });
          return Response.json({
            ok: true,
            ms: Date.now() - started,
            length: run.output.length,
            title: run.title,
            head: run.output.slice(0, 600),
            tail: run.output.slice(-300),
          });
        } catch (error) {
          return Response.json({
            ok: false,
            ms: Date.now() - started,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
  },
});
