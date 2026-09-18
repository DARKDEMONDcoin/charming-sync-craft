import { createFileRoute } from "@tanstack/react-router";

// مسار اختبار مؤقت للقدرات — محمي بمفتاح ثابت ويُحذف بعد الاختبار.
const GUARD = "megsy-skilltest-2026";

export const Route = createFileRoute("/api/public/skilltest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-skilltest") !== GUARD)
          return new Response("no", { status: 401 });
        const body = (await request.json()) as {
          workspaceId: string;
          employeeId: string;
          skillId: string;
          values?: Record<string, string>;
        };
        const started = Date.now();
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { executeSkill } = await import("@/lib/nour-run.server");
          const run = await executeSkill(supabaseAdmin, {
            workspaceId: body.workspaceId,
            employeeId: body.employeeId,
            skillId: body.skillId,
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
