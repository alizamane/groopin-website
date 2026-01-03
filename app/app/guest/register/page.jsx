"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Button from "../../../../components/ui/button";
import Checkbox from "../../../../components/ui/checkbox";
import DateTimeField from "../../../../components/ui/date-time-field";
import Input from "../../../../components/ui/input";
import RadioGroup from "../../../../components/ui/radio-group";
import { useI18n } from "../../../../components/i18n-provider";
import { apiRequest } from "../../../lib/api-client";
import { setSession } from "../../../lib/session";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sex, setSex] = useState("male");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (!termsAccepted) {
      setStatus(t("validation.terms_required"));
      return;
    }

    try {
      setSubmitting(true);
      setStatus("");

      const payload = {
        first_name: formData.get("first_name")?.toString().trim(),
        last_name: formData.get("last_name")?.toString().trim(),
        email: formData.get("email")?.toString().trim(),
        sex,
        date_of_birth: dateOfBirth || null,
        password: formData.get("password")?.toString(),
        password_confirmation: formData
          .get("password_confirmation")
          ?.toString(),
        is_terms_accepted: termsAccepted
      };

      const response = await apiRequest("register", {
        method: "POST",
        body: payload,
        auth: false
      });

      if (!response?.meta?.token) {
        throw new Error("Missing auth token");
      }

      setSession(response.meta.token, response.data);
      router.push("/app/auth/otp-verify-email-verification?isSent=true");
    } catch (error) {
      setStatus(error?.data?.message || t("general.error_has_occurred"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col justify-center px-1 pb-10 pt-6">
      <h1 className="mb-3 mt-6 text-3xl font-bold text-primary-800">
        {t("auth.register_title")}
      </h1>
      <p className="mb-8 text-secondary-400">
        {t("auth.register_description")}
      </p>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <p className="mb-2 text-neutral-700">{t("Sex")}</p>
          <RadioGroup
            name="sex"
            options={[
              { label: t("male"), value: "male" },
              { label: t("female"), value: "female" }
            ]}
            value={sex}
            onChange={setSex}
          />
        </div>

        <Input name="first_name" label={t("First Name")} required />
        <Input name="last_name" label={t("Last Name")} required />
        <Input name="email" label={t("Email")} type="email" required />
        <DateTimeField
          name="date_of_birth"
          label={t("date_of_birth")}
          value={dateOfBirth}
          onChange={setDateOfBirth}
        />
        <Input name="password" label={t("Password")} type="password" required />
        <Input
          name="password_confirmation"
          label={t("auth.password_confirmation")}
          type="password"
          required
        />

        <Checkbox
          checked={termsAccepted}
          onChange={setTermsAccepted}
          label={
            <>
              {t("auth.i_agree_to")}{" "}
              <Link
                href="/app/guest/terms-and-conditions"
                className="text-primary-600"
              >
                {t("auth.terms")}
              </Link>
            </>
          }
        />

        {status ? (
          <p className="text-sm text-danger-600">{status}</p>
        ) : null}

        <Button
          type="submit"
          label={submitting ? t("Processing login") : t("auth.register")}
          size="lg"
          className="w-full"
          disabled={submitting}
        />
      </form>

      <div className="mt-8 flex items-center justify-center gap-1 text-sm">
        <span className="text-neutral-600">
          {t("auth.already_have_account")}
        </span>
        <Link href="/app/guest/login" className="font-medium text-primary-600">
          {t("auth.login")}
        </Link>
      </div>
    </div>
  );
}
