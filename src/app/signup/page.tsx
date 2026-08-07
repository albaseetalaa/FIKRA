import React from "react";
import { redirect } from "next/navigation";

import { getOptionalUser } from "@/lib/auth/getOptionalUser";
import { sanitizeNextPath } from "../../lib/auth/nextPath";

import SignupForm from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next, "/");

  const user = await getOptionalUser();
  if (user) {
    redirect(nextPath);
  }

  return <SignupForm nextPath={nextPath} />;
}
