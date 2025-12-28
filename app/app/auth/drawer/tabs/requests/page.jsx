"use client";

import React, { useEffect, useState } from "react";

import OfferCard from "../../../../../../components/offers/offer-card";
import { useI18n } from "../../../../../../components/i18n-provider";
import { apiRequest } from "../../../../../lib/api-client";
import { getUser } from "../../../../../lib/session";

export default function RequestsPage() {
  const { t } = useI18n();
  const [selected, setSelected] = useState("accepted");
  const [offers, setOffers] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const user = getUser();
  const filters = [
    { label: t("Accepted"), value: "accepted" },
    { label: t("Pending"), value: "pending" },
    { label: t("closed offers"), value: "closed" }
  ];

  useEffect(() => {
    setStatus("loading");
    setError("");

    const fetcher =
      selected === "pending"
        ? apiRequest("requests")
        : apiRequest(
            `my-offers/participated?filter[status]=${
              selected === "closed" ? "closed" : "active"
            }`
          );

    fetcher
      .then((payload) => {
        const data = payload?.data || [];
        const mapped =
          selected === "pending"
            ? data.map((item) => item.offer).filter(Boolean)
            : data;
        setOffers(mapped);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err?.message || t("general.error_has_occurred"));
        setStatus("error");
      });
  }, [selected, t]);

  return (
    <div className="space-y-6">
      <div className="sticky top-20 z-30 flex justify-center">
        <div className="flex justify-center gap-2 rounded-full bg-white/95 p-2 shadow-sm backdrop-blur">
          {filters.map((filter) => {
            const active = selected === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setSelected(filter.value)}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  active
                    ? "bg-secondary-500 text-white"
                    : "text-secondary-500"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {status === "loading" ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="h-32 animate-pulse rounded-2xl bg-neutral-100"
            />
          ))}
        </div>
      ) : null}

      {status === "error" ? (
        <p className="text-sm text-danger-600">{error}</p>
      ) : null}

      {status === "ready" && offers.length === 0 ? (
        <p className="text-sm text-secondary-400">{t("nothingToShow")}</p>
      ) : null}

      {status === "ready" ? (
        <div className="grid gap-5 md:grid-cols-2">
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              currentUserId={user?.id}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
