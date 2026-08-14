import { AuthenticationRequiredError, requireAuthenticatedUser } from "@/lib/auth/requireAuthenticatedUser";
import { NextResponse } from "next/server";
import { authorizeProjectStart, ProjectStartAuthorizationError, startBusinessStrategistExecution } from "@/lib/project-workflow/service";
import { PersistenceConfigurationError } from "@/lib/persistence/setup";

export async function POST(req: Request) {
  let projectId: string | undefined;

  try {
    const user = await requireAuthenticatedUser();
    const body = (await req.json()) as { projectId?: string };
    projectId = String(body?.projectId ?? "").trim();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    const handoff = await authorizeProjectStart({ userId: user.id }, projectId);
    if (!handoff) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    await startBusinessStrategistExecution(handoff);
    return NextResponse.json({ status: "running" });
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 },
      );
    }

    if (error instanceof ProjectStartAuthorizationError) {
      return NextResponse.json(
        { error: "Project not found." },
        { status: 404 },
      );
    }

    if (error instanceof PersistenceConfigurationError) {
      console.error("[api/projects/start] persistence is not configured for this environment", {
        projectId: projectId ?? null,
      });
      return NextResponse.json(
        {
          error:
            "Your project is saved, but the AI workflow could not start because this environment isn't fully configured yet. Please try again shortly.",
          code: "persistence_unavailable",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Could not start execution." }, { status: 500 });
  }
}
