import { AuthenticationRequiredError, requireAuthenticatedUser } from "@/lib/auth/requireAuthenticatedUser";
import { NextResponse } from "next/server";
import {
  ResumeRequestAlreadyConsumedError,
  ResumeRequestMismatchError,
  ResumeValidationError,
  StaleCheckpointError,
  WorkflowNotPausedError,
} from "@/ai/reliability";
import { authorizeWorkflowResume, resumeWorkflow, WorkflowResumeAuthorizationError } from "@/lib/project-workflow/service";
import { resumeRequestBodySchema, resumeResponseSchema } from "@/lib/project-workflow/resumeContract";

export async function POST(req: Request, ctx: { params: Promise<{ workflowRunId: string }> }) {
  try {
    const user = await requireAuthenticatedUser();
    const params = await ctx.params;
    const payload = await req.json();
    const body = resumeRequestBodySchema.parse(payload);

    const handoff = await authorizeWorkflowResume({ userId: user.id }, params.workflowRunId);
    if (!handoff) {
      return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    }

    const result = await resumeWorkflow(handoff, {
      requestId: body.requestId,
      checkpointVersion: body.checkpointVersion,
      values: body.values,
    });

    return NextResponse.json(resumeResponseSchema.parse(result));
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 },
      );
    }

    if (error instanceof WorkflowResumeAuthorizationError) {
      return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    }

    if (error instanceof ResumeValidationError) {
      return NextResponse.json({ state: "validation_error", error: error.message }, { status: 400 });
    }
    if (error instanceof ResumeRequestMismatchError) {
      return NextResponse.json({ state: "validation_error", error: error.message }, { status: 400 });
    }
    if (error instanceof ResumeRequestAlreadyConsumedError) {
      return NextResponse.json({ state: "duplicate_request", error: error.message }, { status: 409 });
    }
    if (error instanceof StaleCheckpointError) {
      return NextResponse.json({ state: "stale_request", error: error.message }, { status: 409 });
    }
    if (error instanceof WorkflowNotPausedError) {
      return NextResponse.json({ state: "invalid_state", error: error.message }, { status: 409 });
    }

    return NextResponse.json({ error: "Could not resume workflow." }, { status: 500 });
  }
}
