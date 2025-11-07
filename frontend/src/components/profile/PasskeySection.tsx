"use client";

import { useCallback, useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import PasskeyButton from "@/components/passkey-button";
import { registerPasskey, isPasskeySupported, isPlatformAuthenticatorAvailable } from "@/lib/webauthn";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

export default function PasskeySection() {
  const { addToast } = useToast();
  const { data: session } = useSession();
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [credentials, setCredentials] = useState<Array<{ id: string; createdAt?: string }>>([]);

  // Lazy-check support to avoid SSR issues
  if (supported === null && typeof window !== "undefined") {
    Promise.all([Promise.resolve(isPasskeySupported()), isPlatformAuthenticatorAvailable()])
      .then(([a, b]) => setSupported(a && b))
      .catch(() => setSupported(false));
  }

  const handleRegister = useCallback(async () => {
    try {
      await registerPasskey("");
      addToast({ title: "Passkey added", variant: "success" });
      // refresh list
      try {
        if (!session?.accessToken) return;
        const resp = await fetch(`${apiBase}/webauthn/credentials`, { headers: { Authorization: `Bearer ${session.accessToken as string}` } });
        if (resp.ok) {
          const data = await resp.json();
          setCredentials((data?.credentials ?? []) as Array<{ id: string; createdAt?: string }>);
        }
      } catch {}
    } catch (e) {
      addToast({ title: "Passkey setup failed", variant: "error" });
    }
  }, [addToast]);

  useEffect(() => {
    const load = async () => {
      try {
        if (!session?.accessToken) return;
        const resp = await fetch(`${apiBase}/webauthn/credentials`, { headers: { Authorization: `Bearer ${session.accessToken as string}` } });
        if (resp.ok) {
          const data = await resp.json();
          setCredentials((data?.credentials ?? []) as Array<{ id: string; createdAt?: string }>);
        }
      } catch {}
    };
    void load();
  }, [session?.accessToken, apiBase]);

  const onDelete = async (id: string) => {
    if (!session?.accessToken) return;
    try {
      const resp = await fetch(`${apiBase}/webauthn/credentials/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.accessToken as string}` },
      });
      if (resp.ok) {
        setCredentials((prev) => prev.filter((c) => c.id !== id));
        addToast({ title: "Passkey removed", variant: "success" });
      } else {
        addToast({ title: "Failed to remove passkey", description: await resp.text(), variant: "error" });
      }
    } catch {
      addToast({ title: "Network error", variant: "error" });
    }
  };

  return (
    <div className="border rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Passkey Authentication</div>
          <div className="text-sm text-muted-foreground">Add a passkey (Face ID / Touch ID / Windows Hello) to sign in without passwords.</div>
        </div>
        {supported ? (
          <PasskeyButton onPasskeyAuth={handleRegister} className="w-auto">Add Passkey</PasskeyButton>
        ) : (
          <div className="text-sm text-muted-foreground">Not supported on this device</div>
        )}
      </div>
      {credentials.length > 0 && (
        <div className="mt-1 space-y-2">
          {credentials.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="text-sm">
                <div className="font-mono break-all text-xs">{c.id}</div>
                {c.createdAt && (
                  <div className="text-muted-foreground text-xs">Added {new Date(c.createdAt).toLocaleString()}</div>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => onDelete(c.id)}>Remove</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


