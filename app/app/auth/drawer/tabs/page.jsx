"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import OfferCard from "../../../../../components/offers/offer-card";
import Button from "../../../../../components/ui/button";
import Modal from "../../../../../components/ui/modal";
import { useI18n } from "../../../../../components/i18n-provider";
import { apiRequest } from "../../../../lib/api-client";
import { getUser } from "../../../../lib/session";

const buildFilterParams = (filters) => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      if (key.includes("between")) {
        const [min, max] = value;
        if (min === null && max === null) return;
        params.append(`filter[${key}]`, `${min ?? ""},${max ?? ""}`);
        return;
      }
      if (value.length > 0) {
        params.append(`filter[${key}]`, value.join(","));
      }
      return;
    }

    if (value !== "") {
      params.append(`filter[${key}]`, String(value));
    }
  });

  return params.toString();
};

export default function TabsHomePage() {
  const { t } = useI18n();
  const [offers, setOffers] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [interests, setInterests] = useState([]);
  const [maritalStatus, setMaritalStatus] = useState([]);
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const user = getUser();

  const [filters, setFilters] = useState({
    title: "",
    category: null,
    sex: null,
    city: null,
    participants_count_between: null,
    budget_between: null,
    age_between: null,
    start_time_between: null,
    start_date_between: null,
    interests: null,
    marital_status: null
  });

  const [localFilters, setLocalFilters] = useState(filters);
  const timeRanges = useMemo(
    () => [
      { id: "morning", range: [8, 14], label: "8h - 14h" },
      { id: "afternoon", range: [14, 19], label: "14h - 19h" },
      { id: "evening", range: [19, 23], label: `${t("Starting from ")}19h` }
    ],
    [t]
  );

  useEffect(() => {
    apiRequest("parameters")
      .then((payload) => {
        setCategories(payload?.categories || []);
        setCities(payload?.cities || []);
        const offerQuestions = payload?.dynamic_questions?.offer || [];
        const jobOptions =
          offerQuestions.find((item) => item.name === "job")
            ?.formatted_settings?.options || [];
        const maritalOptions =
          offerQuestions.find((item) => item.name === "marital_status")
            ?.formatted_settings?.options || [];
        setInterests(jobOptions);
        setMaritalStatus(maritalOptions);
      })
      .catch(() => {
        setCategories([]);
        setCities([]);
        setInterests([]);
        setMaritalStatus([]);
      });
  }, []);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        title: searchValue ? searchValue.trim() : ""
      }));
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchValue]);

  useEffect(() => {
    setStatus("loading");
    const query = buildFilterParams(filters);
    const endpoint = query ? `offers?${query}` : "offers";
    apiRequest(endpoint)
      .then((payload) => {
        setOffers(payload?.data || []);
        setStatus("ready");
        setError("");
      })
      .catch((err) => {
        setError(err?.message || t("general.error_has_occurred"));
        setStatus("error");
      });
  }, [filters, t]);

  const hasFilters = useMemo(() => {
    return Object.entries(filters)
      .filter(([key]) => key !== "category")
      .some(([_, value]) => {
        if (value === null || value === undefined) return false;
        if (Array.isArray(value)) {
          return value.some((item) => item !== null && item !== "");
        }
        return value !== "";
      });
  }, [filters]);

  const updateRange = (key, index, value) => {
    const numberValue = value === "" ? null : Number(value);
    setLocalFilters((prev) => {
      const current = prev[key] || [null, null];
      const next = [...current];
      next[index] = Number.isNaN(numberValue) ? null : numberValue;
      if (next[0] === null && next[1] === null) {
        return { ...prev, [key]: null };
      }
      return { ...prev, [key]: next };
    });
  };

  const updateDateRange = (index, value) => {
    setLocalFilters((prev) => {
      const current = prev.start_date_between || [null, null];
      const next = [...current];
      next[index] = value || null;
      if (!next[0] && !next[1]) {
        return { ...prev, start_date_between: null };
      }
      return { ...prev, start_date_between: next };
    });
  };

  const handleApplyFilters = () => {
    setFilters(localFilters);
    setFilterOpen(false);
  };

  const handleResetFilters = () => {
    const reset = {
      ...filters,
      sex: null,
      city: null,
      participants_count_between: null,
      budget_between: null,
      age_between: null,
      start_time_between: null,
      start_date_between: null,
      interests: null,
      marital_status: null
    };
    setLocalFilters(reset);
    setFilters(reset);
  };

  const setCategory = (categoryId) => {
    const nextCategory = categoryId ? [categoryId] : null;
    setFilters((prev) => ({ ...prev, category: nextCategory }));
    setLocalFilters((prev) => ({ ...prev, category: nextCategory }));
  };

  const renderChip = (key, label, isActive, onClick) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
        isActive
          ? "border-secondary-600 bg-secondary-600 text-white"
          : "border-[#EADAF1] text-secondary-500"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={t("Search")}
            className="w-full rounded-full border border-[#EADAF1] px-4 py-2 text-sm text-secondary-600 outline-none focus:border-secondary-600"
          />
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className={`flex h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold transition md:w-36 ${
              hasFilters
                ? "border-secondary-600 bg-secondary-600 text-white"
                : "border-[#EADAF1] text-secondary-600"
            }`}
          >
            {t("Filters")}
          </button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-1 flex-wrap items-center gap-2 pb-1 md:flex-nowrap md:overflow-x-auto">
              {renderChip(
                "category-all",
                t("All"),
                !filters.category || filters.category.length === 0,
                () => setCategory(null)
              )}
              {categories.map((category, index) =>
                renderChip(
                  `category-${category.id ?? category.name ?? index}`,
                  category.name,
                  filters.category?.includes(category.id),
                  () => setCategory(category.id)
                )
              )}
          </div>
        </div>
      </div>

      {status === "loading" ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
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
            <OfferCard key={offer.id} offer={offer} currentUserId={user?.id} />
          ))}
        </div>
      ) : null}

      <Modal
        open={isFilterOpen}
        title={t("Filters")}
        onClose={() => setFilterOpen(false)}
      >
        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-2">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-secondary-600"
            >
              {t("Reset")}
            </button>
          </div>

          <div className="space-y-3 border-b border-[#EADAF1] pb-4">
            <p className="text-sm font-semibold text-primary-900">
              {t("Sex")}
            </p>
            <div className="flex flex-wrap gap-2">
              {renderChip("sex-all", t("All"), !localFilters.sex, () =>
                setLocalFilters((prev) => ({ ...prev, sex: null }))
              )}
              {renderChip("sex-male", t("male"), localFilters.sex === "male", () =>
                setLocalFilters((prev) => ({ ...prev, sex: "male" }))
              )}
              {renderChip(
                "sex-female",
                t("female"),
                localFilters.sex === "female",
                () => setLocalFilters((prev) => ({ ...prev, sex: "female" }))
              )}
            </div>
          </div>

          <div className="space-y-3 border-b border-[#EADAF1] pb-4">
            <p className="text-sm font-semibold text-primary-900">
              {t("City")}
            </p>
            <select
              value={localFilters.city?.[0] || ""}
              onChange={(event) => {
                const value = event.target.value;
                setLocalFilters((prev) => ({
                  ...prev,
                  city: value ? [Number(value)] : null
                }));
              }}
              className="w-full rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
            >
              <option value="">{t("All")}</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 border-b border-[#EADAF1] pb-4">
            <p className="text-sm font-semibold text-primary-900">
              {t("Participants")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="0"
                value={localFilters.participants_count_between?.[0] ?? ""}
                onChange={(event) =>
                  updateRange(
                    "participants_count_between",
                    0,
                    event.target.value
                  )
                }
                placeholder={t("Min")}
                className="rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
              />
              <input
                type="number"
                min="0"
                value={localFilters.participants_count_between?.[1] ?? ""}
                onChange={(event) =>
                  updateRange(
                    "participants_count_between",
                    1,
                    event.target.value
                  )
                }
                placeholder={t("Max")}
                className="rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
              />
            </div>
          </div>

          <div className="space-y-3 border-b border-[#EADAF1] pb-4">
            <p className="text-sm font-semibold text-primary-900">{t("Age")}</p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="0"
                value={localFilters.age_between?.[0] ?? ""}
                onChange={(event) =>
                  updateRange("age_between", 0, event.target.value)
                }
                placeholder={t("Min")}
                className="rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
              />
              <input
                type="number"
                min="0"
                value={localFilters.age_between?.[1] ?? ""}
                onChange={(event) =>
                  updateRange("age_between", 1, event.target.value)
                }
                placeholder={t("Max")}
                className="rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
              />
            </div>
          </div>

          <div className="space-y-3 border-b border-[#EADAF1] pb-4">
            <p className="text-sm font-semibold text-primary-900">
              {t("Budget")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="0"
                value={localFilters.budget_between?.[0] ?? ""}
                onChange={(event) =>
                  updateRange("budget_between", 0, event.target.value)
                }
                placeholder={t("Min")}
                className="rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
              />
              <input
                type="number"
                min="0"
                value={localFilters.budget_between?.[1] ?? ""}
                onChange={(event) =>
                  updateRange("budget_between", 1, event.target.value)
                }
                placeholder={t("Max")}
                className="rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
              />
            </div>
          </div>

          <div className="space-y-3 border-b border-[#EADAF1] pb-4">
            <p className="text-sm font-semibold text-primary-900">
              {t("Start Time")}
            </p>
            <div className="flex flex-wrap gap-2">
              {renderChip(
                "start-time-all",
                t("All"),
                !localFilters.start_time_between,
                () =>
                  setLocalFilters((prev) => ({
                    ...prev,
                    start_time_between: null
                  }))
              )}
              {timeRanges.map((range, index) =>
                renderChip(
                  `start-time-${range.id ?? index}`,
                  range.label,
                  localFilters.start_time_between?.[0] === range.range[0] &&
                    localFilters.start_time_between?.[1] === range.range[1],
                  () =>
                    setLocalFilters((prev) => ({
                      ...prev,
                      start_time_between: range.range
                    }))
                )
              )}
            </div>
          </div>

          <div className="space-y-3 border-b border-[#EADAF1] pb-4">
            <p className="text-sm font-semibold text-primary-900">
              {t("Start date")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={localFilters.start_date_between?.[0] ?? ""}
                onChange={(event) => updateDateRange(0, event.target.value)}
                className="rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
              />
              <input
                type="date"
                value={localFilters.start_date_between?.[1] ?? ""}
                onChange={(event) => updateDateRange(1, event.target.value)}
                className="rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
              />
            </div>
          </div>

          <div className="space-y-3 border-b border-[#EADAF1] pb-4">
            <p className="text-sm font-semibold text-primary-900">
              {t("Interests")}
            </p>
            <select
              value={localFilters.interests || ""}
              onChange={(event) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  interests: event.target.value || null
                }))
              }
              className="w-full rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
            >
              <option value="">{t("All")}</option>
              {interests.map((interest) => (
                <option
                  key={interest.value}
                  value={String(interest.value)}
                >
                  {interest.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-primary-900">
              {t("marital_status")}
            </p>
            <select
              value={localFilters.marital_status || ""}
              onChange={(event) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  marital_status: event.target.value || null
                }))
              }
              className="w-full rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
            >
              <option value="">{t("All")}</option>
              {maritalStatus.map((status) => (
                <option key={status.value} value={String(status.value)}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            label={t("Close")}
            className="w-full"
            onClick={() => setFilterOpen(false)}
          />
          <Button
            label={t("Validate")}
            className="w-full"
            onClick={handleApplyFilters}
          />
        </div>
      </Modal>

      <Link
        href="/app/auth/my-offers/create"
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-secondary-600 text-white shadow-lg transition hover:bg-secondary-500"
        aria-label={t("offers.create_offer")}
        title={t("offers.create_offer")}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </Link>
    </div>
  );
}
