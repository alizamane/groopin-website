"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Button from "../../../../components/ui/button";
import { useI18n } from "../../../../components/i18n-provider";
import { apiRequest } from "../../../lib/api-client";
import { setSession } from "../../../lib/session";

export default function SocialCallbackClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params?.get("token") || "";
    if (!token) {
      setStatus("error");
      setError(t("general.error_has_occurred"));
      return;
    }

    const finalizeLogin = async () => {
      try {
        setSession(token);
        const userResponse = await apiRequest("user", { method: "GET" });
        setSession(token, userResponse?.data);
        router.replace("/app/auth/drawer/tabs");
      } catch (err) {
        setError(err?.data?.message || t("general.error_has_occurred"));
        setStatus("error");
      }
    };

    finalizeLogin();
  }, [params, router, t]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-secondary-500">
          {t("Processing login")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <p className="text-sm text-danger-600">{error}</p>
      <Button
        label={t("auth.login")}
        onClick={() => router.replace("/app/guest/login")}
      />
    </div>
  );
}
