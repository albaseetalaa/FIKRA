import { AuthenticationRequiredError, requireAuthenticatedUser } from "@/lib/auth/requireAuthenticatedUser";
import { NextResponse } from "next/server";
import type { ProjectHistoryResponse } from "@/lib/project-workflow/historyContract";
import { listProjectHistory, PersistenceConfigurationError } from "@/lib/project-workflow/service";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    const items = await listProjectHistory({ userId: user.id }, 50);
    const payload: ProjectHistoryResponse = { items };
    return NextResponse.json(payload);
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 },
      );
    }

    if (error instanceof PersistenceConfigurationError) {
      console.error("[api/projects/history] persistence is not configured for this environment", {
        reason: error.message,
      });
      return NextResponse.json(
        {
          error:
            "Your project history isn't available right now because this environment isn't fully configured yet. Please try again shortly.",
          code: "persistence_unavailable",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: "Could not load project history." }, { status: 500 });
  }
}
