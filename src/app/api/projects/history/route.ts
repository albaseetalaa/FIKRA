import { NextResponse } from "next/server";
import type { ProjectHistoryResponse } from "@/lib/project-workflow/historyContract";
import { listProjectHistory } from "@/lib/project-workflow/service";

export async function GET() {
  try {
    const items = await listProjectHistory(50);
    const payload: ProjectHistoryResponse = { items };
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Could not load project history." }, { status: 500 });
  }
}
