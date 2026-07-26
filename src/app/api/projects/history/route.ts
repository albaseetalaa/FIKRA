import { NextResponse } from "next/server";
import { listProjectHistory } from "@/lib/project-workflow/service";

export async function GET() {
  try {
    const items = await listProjectHistory(50);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Could not load project history." }, { status: 500 });
  }
}
