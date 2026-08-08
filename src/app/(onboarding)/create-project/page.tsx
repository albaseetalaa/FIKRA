import React from "react";
import { redirect } from "next/navigation";

import { getOptionalUser } from "@/lib/auth/getOptionalUser";

import CreateProjectWizard from "./CreateProjectWizard";

export default async function CreateProjectPage() {
  const user = await getOptionalUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/create-project")}`);
  }

  return <CreateProjectWizard userId={user.id} />;
}
