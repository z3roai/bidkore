"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Logo from "@/components/logo";
import MainButton from "@/components/main-button";
import { useToast } from "@/components/ui/toast";

function MicrosoftCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const [status, setStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const code = useMemo(() => searchParams.get("code") ?? "", [searchParams]);
  const state = useMemo(() => searchParams.get("state") ?? "", [searchParams]);
  const modeFromQuery = useMemo(
    () => searchParams.get("mode") ?? "",
    [searchParams]
  );
  const oauthError = useMemo(
    () => searchParams.get("error") ?? "",
    [searchParams]
  );
  const oauthErrorDescription = useMemo(
    () => searchParams.get("error_description") ?? "",
    [searchParams]
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Handle OAuth error returned by Microsoft
      if (oauthError) {
        setStatus("error");
        setErrorMessage(
          oauthErrorDescription ||
            "Microsoft sign-in was cancelled or failed. Please try again."
        );
        addToast({
          title: "Microsoft sign-in failed",
          description: oauthErrorDescription || "Please try again.",
          variant: "error",
          duration: 5000,
        });
        return;
      }

      // Validate required params
      if (!code || !state) {
        setStatus("error");
        setErrorMessage(
          "Missing authorization parameters. Please start the sign-in again."
        );
        addToast({
          title: "Invalid callback",
          description:
            "Missing authorization parameters. Please try signing in again.",
          variant: "error",
          duration: 5000,
        });
        return;
      }

      setStatus("processing");

      try {
        // Exchange the authorization code with the backend
        const resp = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/microsoft/callback`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            // mode is optional because backend associates it with stored state,
            // passing it is harmless and can help in some edge cases
            body: JSON.stringify({
              code,
              state,
              ...(modeFromQuery ? { mode: modeFromQuery } : {}),
            }),
          }
        );

        const data = (await resp.json()) as {
          success?: boolean;
          message?: string;
          token?: string;
          user?: unknown;
          mode?: "login" | "register" | "integration";
          error?: string;
          code?: string;
        };

        if (!resp.ok || (!data?.success && !data?.token)) {
          const msg =
            data?.error ||
            data?.message ||
            "Unable to complete Microsoft sign-in. Please try again.";
          throw new Error(msg);
        }

        // If it's an integration-only flow, just route back to dashboard
        const mode = data.mode || modeFromQuery || "login";
        if (mode === "integration") {
          setStatus("success");
          addToast({
            title: "Microsoft connected",
            description: "Your Microsoft account is now connected.",
            variant: "success",
            duration: 4000,
          });
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        // For login/register, sign in to NextAuth using the backend JWT
        if (data.token) {
          const result = await signIn("credentials", {
            token: data.token,
            redirect: false,
          });

          if (result?.error) {
            throw new Error(result.error);
          }

          setStatus("success");
          addToast({
            title: "Welcome",
            description: "You have signed in with Microsoft.",
            variant: "success",
            duration: 3000,
          });

          router.replace("/dashboard");
          router.refresh();
          return;
        }

        // Fallback if no token returned
        throw new Error("No token received from backend. Please try again.");
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error
            ? err.message
            : "Unexpected error during Microsoft sign-in.";
        setStatus("error");
        setErrorMessage(msg);

        addToast({
          title: "Microsoft sign-in failed",
          description: msg,
          variant: "error",
          duration: 6000,
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    code,
    state,
    modeFromQuery,
    oauthError,
    oauthErrorDescription,
    addToast,
    router,
  ]);

  const onTryAgain = () => {
    router.replace("/signin");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>

        {status === "processing" && (
          <>
            <h1 className="text-2xl font-semibold text-foreground">
              Connecting to Microsoft...
            </h1>
            <p className="text-sm text-muted-foreground">
              Please wait while we complete your sign-in.
            </p>
            <div className="flex justify-center pt-2">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <h1 className="text-2xl font-semibold text-foreground">Success</h1>
            <p className="text-sm text-muted-foreground">
              Redirecting to your dashboard...
            </p>
          </>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold text-destructive">
              Sign-in failed
            </h1>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <div className="pt-2">
              <MainButton className="w-full" size="lg" onClick={onTryAgain}>
                Back to Sign In
              </MainButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Loading...</h1>
        <p className="text-sm text-muted-foreground">
          Please wait while we process your request.
        </p>
        <div className="flex justify-center pt-2">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      </div>
    </div>
  );
}

export default function MicrosoftCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MicrosoftCallbackContent />
    </Suspense>
  );
}
