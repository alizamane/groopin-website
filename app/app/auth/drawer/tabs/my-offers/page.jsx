"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

import OfferCard from "../../../../../../components/offers/offer-card";
import Button from "../../../../../../components/ui/button";
import Modal from "../../../../../../components/ui/modal";
import { useI18n } from "../../../../../../components/i18n-provider";
import { apiRequest } from "../../../../../lib/api-client";
import { getUser } from "../../../../../lib/session";

export default function MyOffersPage() {
  const { t } = useI18n();
  const [offers, setOffers] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [isBulkModalOpen, setBulkModalOpen] = useState(false);
  const user = getUser();

  const STATUS_FILTERS = [
    { label: t("Actives"), value: "active" },
    { label: t("Draft"), value: "draft" },
    { label: t("Pending"), value: "pending" },
    { label: t("closed"), value: "closed" }
  ];

  useEffect(() => {
    setStatus("loading");
    apiRequest(`my-offers?filter[status]=${selectedStatus}`)
      .then((payload) => {
        setOffers(payload?.data || []);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err?.message || t("general.error_has_occurred"));
        setStatus("error");
      });
  }, [selectedStatus, t]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/app/auth/my-offers/create">
            <Button label={t("offers.create_offer")} size="sm" className="px-4" />
          </Link>
          <Button
            variant="outline"
            label={t("bulk_offers")}
            size="sm"
            className="px-4"
            onClick={() => setBulkModalOpen(true)}
          />
        </div>
      </div>

      <div className="sticky top-20 z-30 flex justify-center">
        <div className="flex justify-center gap-2 rounded-full bg-white/95 p-2 shadow-sm backdrop-blur">
          {STATUS_FILTERS.map((filter) => {
            const active = selectedStatus === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setSelectedStatus(filter.value)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  active ? "bg-secondary-500 text-white" : "text-secondary-500"
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
        <div className="grid auto-rows-fr items-stretch gap-5 md:grid-cols-2">
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              currentUserId={user?.id}
            />
          ))}
        </div>
      ) : null}

      <Modal
        open={isBulkModalOpen}
        title={t("bulk_offers")}
        onClose={() => setBulkModalOpen(false)}
      >
        <p className="text-sm text-secondary-500">
          {t("bulk_offers_notice")}
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            label={t("Close")}
            className="w-full"
            onClick={() => setBulkModalOpen(false)}
          />
          <Button
            label={t("Contact us")}
            className="w-full"
            onClick={() => (window.location.href = "mailto:contact@groopin.io")}
          />
        </div>
      </Modal>
    </div>
  );
}
