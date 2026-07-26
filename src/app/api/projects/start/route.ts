import { NextResponse } from "next/server";
import { getProjectStatus, startBusinessStrategistExecution } from "@/lib/project-workflow/service";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { projectId?: string };
    const projectId = String(body?.projectId ?? "").trim();

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    const project = await getProjectStatus(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    await startBusinessStrategistExecution(projectId);
    return NextResponse.json({ status: "running" });
  } catch {
    return NextResponse.json({ error: "Could not start execution." }, { status: 500 });
  }
}
