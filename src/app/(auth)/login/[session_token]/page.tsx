"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

function Page() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const continueUrl = searchParams.get("continue");
  const backendUrl = searchParams.get("backend_url");
  const refreshToken = searchParams.get("refresh_token");
  const sessionToken = params?.session_token;

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!backendUrl) {
      setError("Invalid backend URL");
      return;
    }
    if (!sessionToken || typeof sessionToken !== "string") {
      setError("Invalid session token");
      return;
    }

    // axios.ts reads localStorage.getItem("accessToken") as the bearer
    // token (and "backend_url" for the dynamic baseURL) — NOT
    // "session_token". Writing under the wrong key meant every request
    // went out unauthenticated, triggered a 401 → failed refresh (no
    // refreshToken either) → handleAuthFailure() → hard redirect to
    // /login with no token segment → 404.
    localStorage.setItem("accessToken", sessionToken);
    localStorage.setItem("backend_url", backendUrl);
    if (refreshToken) {
      localStorage.setItem("refreshToken", refreshToken);
    }
    router.replace(continueUrl || "/");
    // Only re-run if the actual inputs change; router/continueUrl are
    // derived from the URL and stable for the lifetime of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendUrl, sessionToken, refreshToken]);

  if (error) {
    return <div>{error}</div>;
  }

  return <div>Signing you in…</div>;
}

export default Page;