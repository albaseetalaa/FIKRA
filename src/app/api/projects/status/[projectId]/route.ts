import { AuthenticationRequiredError, requireAuthenticatedUser } from "@/lib/auth/requireAuthenticatedUser";
import { NextResponse } from "next/server";
import { getProjectStatus } from "@/lib/project-workflow/service";

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const params = await ctx.params;
    const project = await getProjectStatus(params.projectId);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    return NextResponse.json({
      projectId: project.projectId,
      name: project.name,
      idea: project.idea,
      status: project.status,
      currentStep: project.currentStep,
      errorMessage: project.errorMessage,
      startedAt: project.startedAt,
      completedAt: project.completedAt,
      workflowStatus: project.workflowStatus,
      pausedTaskId: project.pausedTaskId,
      userInputRequest: project.userInputRequest,
      capabilities: project.capabilities ?? [],
      businessPlan: project.businessPlan,
      marketResearchReport: project.marketResearchReport,
      financialModel: project.financialModel,
      projectScore: project.projectScore ?? null,
    });
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 },
      );
    }

    return NextResponse.json({ error: "Could not fetch project status." }, { status: 500 });
  }
}
