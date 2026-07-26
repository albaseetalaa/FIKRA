import { NextResponse } from "next/server";
import { createProject } from "@/lib/project-workflow/service";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { idea?: string };
    const idea = String(body?.idea ?? "").trim();

    if (idea.length < 10) {
      return NextResponse.json({ error: "Please provide a more detailed project idea." }, { status: 400 });
    }

    const project = await createProject(idea);
    return NextResponse.json({
      projectId: project.projectId,
      status: project.status,
    });
  } catch {
    return NextResponse.json({ error: "Could not create project." }, { status: 500 });
  }
}
