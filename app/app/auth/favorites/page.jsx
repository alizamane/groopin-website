"use client";

import React, { useEffect, useState } from "react";

import OfferCard from "../../../../components/offers/offer-card";
import { useI18n } from "../../../../components/i18n-provider";
import { apiRequest } from "../../../lib/api-client";
import { getUser } from "../../../lib/session";

export default function FavoritesPage() {
  const { t } = useI18n();
  const [offers, setOffers] = useState([]);
  const [status, setStatus] = useState("loading");
  const user = getUser();

  useEffect(() => {
    apiRequest("offers/favorites?lite=1")
      .then((payload) => {
        setOffers(payload?.data || []);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-primary-800">{t("Favorites")}</h1>

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
        <p className="text-sm text-danger-600">
          {t("general.error_has_occurred")}
        </p>
      ) : null}

      {status === "ready" && offers.length === 0 ? (
        <p className="text-sm text-secondary-400">
          {t("Add offers to your favorites to see them here")}
        </p>
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
