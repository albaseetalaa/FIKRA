import { NextResponse } from "next/server";
import {
  ResumeRequestAlreadyConsumedError,
  ResumeRequestMismatchError,
  ResumeValidationError,
  StaleCheckpointError,
  WorkflowNotPausedError,
} from "@/ai/reliability";
import { resumeWorkflow } from "@/lib/project-workflow/service";
import { resumeRequestBodySchema, resumeResponseSchema } from "@/lib/project-workflow/resumeContract";

export async function POST(req: Request, ctx: { params: Promise<{ workflowRunId: string }> }) {
  try {
    const params = await ctx.params;
    const payload = await req.json();
    const body = resumeRequestBodySchema.parse(payload);

    const result = await resumeWorkflow({
      workflowRunId: params.workflowRunId,
      requestId: body.requestId,
      checkpointVersion: body.checkpointVersion,
      values: body.values,
    });

    return NextResponse.json(resumeResponseSchema.parse(result));
  } catch (error: unknown) {
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
