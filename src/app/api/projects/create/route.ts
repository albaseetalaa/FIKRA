import { AuthenticationRequiredError, requireAuthenticatedUser } from "@/lib/auth/requireAuthenticatedUser";
import { NextResponse } from "next/server";
import { createProject } from "@/lib/project-workflow/service";
import { executeCreateProjectRpc, ProjectCreationValidationError } from "@/lib/project-workflow/createProjectRpc";

export async function POST(req: Request) {
  try {
    await requireAuthenticatedUser();
    const body = (await req.json()) as {
      idea?: string;
      businessName?: string;
      industry?: string;
      country?: string;
      city?: string;
      stage?: string;
      audience?: string;
      ageRange?: string;
      customerType?: string;
      goals?: string[];
      budget?: string;
      timeline?: string;
      currency?: string;
    };
    const idea = String(body?.idea ?? "").trim();

    if (idea.length < 10) {
      return NextResponse.json({ error: "Please provide a more detailed project idea." }, { status: 400 });
    }

    const project = await createProject(
      {
        idea,
        businessName: typeof body.businessName === "string" ? body.businessName : undefined,
        industry: typeof body.industry === "string" ? body.industry : undefined,
        country: typeof body.country === "string" ? body.country : undefined,
        city: typeof body.city === "string" ? body.city : undefined,
        stage: typeof body.stage === "string" ? body.stage : undefined,
        audience: typeof body.audience === "string" ? body.audience : undefined,
        ageRange: typeof body.ageRange === "string" ? body.ageRange : undefined,
        customerType: typeof body.customerType === "string" ? body.customerType : undefined,
        goals: Array.isArray(body.goals) ? body.goals : undefined,
        budget: typeof body.budget === "string" ? body.budget : undefined,
        timeline: typeof body.timeline === "string" ? body.timeline : undefined,
        currency: typeof body.currency === "string" ? body.currency : undefined,
      },
      {
        execute: executeCreateProjectRpc,
      },
    );
    return NextResponse.json({
      projectId: project.projectId,
      status: project.status,
    });
  } catch (error: unknown) {
    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 },
      );
    }

    if (error instanceof ProjectCreationValidationError) {
      return NextResponse.json(
        { error: "Invalid project input." },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "Could not create project." }, { status: 500 });
  }
}
