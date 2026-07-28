import { redirect } from "next/navigation";

export default function DemoProjectPage() {
  // Retire static/demo report rendering and route users to live project history.
  redirect("/projects");
}
