import React from "react";
import { redirect } from "next/navigation";

import { getOptionalUser } from "@/lib/auth/getOptionalUser";
import { sanitizeNextPath } from "@/lib/auth/nextPath";

import LoginForm from "./LoginForm";

export default async function LoginPage({
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

  return <LoginForm nextPath={nextPath} />;
}
