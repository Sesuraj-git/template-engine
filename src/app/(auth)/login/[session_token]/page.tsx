"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import React from "react";

function page() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const continueUrl = searchParams.get("continue");
  const backend_url = searchParams.get("backend_url");
  if (!backend_url) {
    return <div>Invalid backend URL</div>;
  }
  debugger;
  const { session_token } = params;
  if (!session_token || typeof session_token !== "string") {
    return <div>Invalid session token</div>;
  }
  localStorage.setItem("session_token", session_token);
  localStorage.setItem("backend_url", backend_url);
  return router.replace(continueUrl || "/");
  return <div>wait ... </div>;
}

export default page;
