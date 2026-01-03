"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import OfferCard from "../../../../../components/offers/offer-card";
import Button from "../../../../../components/ui/button";
import DateTimeField from "../../../../../components/ui/date-time-field";
import Modal from "../../../../../components/ui/modal";
import { PlusIcon } from "../../../../../components/ui/heroicons";
import { useI18n } from "../../../../../components/i18n-provider";
import { apiRequest } from "../../../../lib/api-client";
import { getUser } from "../../../../lib/session";

const ioniconCache = new Map();

const normalizeIoniconName = (name) => {
  if (!name) return "";
  return String(name).replace(/^(ios|md)-/, "");
};

const Ionicon = ({ name, size = 16, className = "" }) => {
  const normalized = normalizeIoniconName(name);
  const cacheKey = `${normalized}:${size}`;
  const [svgMarkup, setSvgMarkup] = useState(() => {
    return ioniconCache.get(cacheKey) || "";
  });

  useEffect(() => {
    if (!normalized) return;
    if (ioniconCache.has(cacheKey)) {
      setSvgMarkup(ioniconCache.get(cacheKey));
      return;
    }

    fetch(`https://unpkg.com/ionicons@5.5.2/dist/svg/${normalized}.svg`)
      .then((response) => (response.ok ? response.text() : ""))
      .then((rawSvg) => {
        if (!rawSvg) return;
        const sizedSvg = rawSvg.replace(
          "<svg ",
          `<svg width="${size}" height="${size}" `
        );
        ioniconCache.set(cacheKey, sizedSvg);
        setSvgMarkup(sizedSvg);
      })
      .catch(() => {
        // Ignore icon fetch errors and keep fallback.
      });
  }, [cacheKey, normalized, size]);

  if (!normalized) return null;

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgMarkup || "" }}
    />
  );
};

const SearchOutlineIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 512 512"
    fill="none"
    stroke="currentColor"
    strokeWidth="32"
    strokeMiterlimit="10"
    className={className}
    aria-hidden="true"
  >
    <path d="M221.09 64a157.09 157.09 0 10157.09 157.09A157.1 157.1 0 00221.09 64z" />
    <path
      d="M338.29 338.29L448 448"
      strokeLinecap="round"
    />
  </svg>
);

const FunnelOutlineIcon = ({ size = 20, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 512 512"
    fill="none"
    stroke="currentColor"
    strokeWidth="32"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M35.4 87.12l168.65 196.44A16.07 16.07 0 01208 294v119.32a7.93 7.93 0 005.39 7.59l80.15 26.67A7.94 7.94 0 00304 440V294a16.07 16.07 0 014-10.44L476.6 87.12A14 14 0 00466 64H46.05A14 14 0 0035.4 87.12z" />
  </svg>
);

const normalizeDateFilterValue = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split("/");
    return `${year}-${month}-${day}`;
  }
  return trimmed;
};

const buildFilterParams = (filters, derivedCityIds = null) => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (key === "country") return;
    if (key === "city" && (value === null || value === undefined)) {
      if (Array.isArray(derivedCityIds) && derivedCityIds.length > 0) {
        params.append(`filter[${key}]`, derivedCityIds.join(","));
      }
      return;
    }
    if (value === null || value === undefined) return;

    if (Array.isArray(value)) {
      if (key === "city" && !value.length) {
        if (Array.isArray(derivedCityIds) && derivedCityIds.length > 0) {
          params.append(`filter[${key}]`, derivedCityIds.join(","));
        }
        return;
      }
      if (key.includes("between")) {
        const [min, max] =
          key === "start_date_between"
            ? value.map(normalizeDateFilterValue)
            : value;
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
  const [nextCursor, setNextCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [interests, setInterests] = useState([]);
  const [maritalStatus, setMaritalStatus] = useState([]);
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const user = getUser();
  const sentinelRef = useRef(null);
  const latestOfferRequestRef = useRef(0);

  const [filters, setFilters] = useState({
    title: "",
    category: null,
    sex: null,
    country: null,
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
  const countryOptions = useMemo(() => {
    const available = new Set(
      cities.map((city) => (city.country_code || "MA").toUpperCase())
    );
    const options = [
      { code: "MA", label: t("countries.ma") },
      { code: "FR", label: t("countries.fr") }
    ];
    return options.filter((option) => available.has(option.code));
  }, [cities, t]);
  const filteredCities = useMemo(() => {
    if (!localFilters.country) return [];
    return cities.filter(
      (city) =>
        (city.country_code || "MA").toUpperCase() === localFilters.country
    );
  }, [cities, localFilters.country]);
  const derivedCountryCityIds = useMemo(() => {
    if (!filters.country || (filters.city && filters.city.length)) {
      return [];
    }
    const countryCode = String(filters.country).toUpperCase();
    return cities
      .filter(
        (city) =>
          (city.country_code || "MA").toUpperCase() === countryCode
      )
      .map((city) => Number(city.id))
      .filter((id) => !Number.isNaN(id));
  }, [filters, cities]);

  useEffect(() => {
    apiRequest("parameters", { cacheTime: 300000 })
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
    if (!cities.length || !localFilters.city?.length) return;
    const selectedCityId = localFilters.city[0];
    const match = cities.find(
      (city) => String(city.id) === String(selectedCityId)
    );
    if (!match) return;
    const nextCode = (match.country_code || "MA").toUpperCase();
    if (nextCode !== localFilters.country) {
      setLocalFilters((prev) => ({
        ...prev,
        country: nextCode
      }));
    }
  }, [cities, localFilters.city, localFilters.country]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const trimmed = searchValue.trim();
      setFilters((prev) => {
        const nextTitle = trimmed ? trimmed : "";
        if (prev.title === nextTitle) return prev;
        return {
          ...prev,
          title: nextTitle
        };
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchValue]);

  const buildOffersEndpoint = (cursor = null) => {
    const query = buildFilterParams(filters, derivedCountryCityIds);
    const params = new URLSearchParams(query);
    if (cursor) {
      params.set("cursor", cursor);
    }
    params.set("lite", "1");
    const qs = params.toString();
    return qs ? `offers?${qs}` : "offers?lite=1";
  };

  useEffect(() => {
    setStatus("loading");
    setError("");
    setIsLoadingMore(false);
    setNextCursor(null);
    setHasNextPage(false);
    const endpoint = buildOffersEndpoint();
    const requestId = (latestOfferRequestRef.current += 1);
    apiRequest(endpoint, { cacheTime: 15000 })
      .then((payload) => {
        if (requestId !== latestOfferRequestRef.current) return;
        const items = payload?.data || [];
        const cursor = payload?.meta?.next_cursor || null;
        setOffers(items);
        setNextCursor(cursor);
        setHasNextPage(Boolean(cursor));
        setStatus("ready");
        setError("");
      })
      .catch((err) => {
        if (requestId !== latestOfferRequestRef.current) return;
        setError(err?.message || t("general.error_has_occurred"));
        setStatus("error");
      });
  }, [filters, derivedCountryCityIds, t]);

  const loadMore = React.useCallback(async () => {
    if (!hasNextPage || isLoadingMore || !nextCursor) return;
    if (status !== "ready") return;
    const requestId = latestOfferRequestRef.current;
    setIsLoadingMore(true);
    try {
      const payload = await apiRequest(buildOffersEndpoint(nextCursor), {
        cache: false
      });
      if (requestId !== latestOfferRequestRef.current) return;
      const items = payload?.data || [];
      const cursor = payload?.meta?.next_cursor || null;
      setOffers((prev) => [...prev, ...items]);
      setNextCursor(cursor);
      setHasNextPage(Boolean(cursor));
    } catch (err) {
      if (requestId !== latestOfferRequestRef.current) return;
      setError(err?.message || t("general.error_has_occurred"));
    } finally {
      if (requestId === latestOfferRequestRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [hasNextPage, isLoadingMore, nextCursor, status, t, filters, derivedCountryCityIds]);

  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, loadMore]);

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

  const addMultiFilter = (key, value) => {
    setLocalFilters((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      if (current.includes(value)) return prev;
      return { ...prev, [key]: [...current, value] };
    });
  };

  const removeMultiFilter = (key, value) => {
    setLocalFilters((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      const next = current.filter((item) => item !== value);
      return { ...prev, [key]: next.length ? next : null };
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
      country: null,
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

  const renderChip = (
    key,
    label,
    isActive,
    onClick,
    iconName = null,
    className = ""
  ) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-normal transition ${className} ${
        isActive
          ? "border-secondary-500 bg-secondary-500 text-white"
          : "border-[#A564C2] bg-white text-secondary-400"
      }`}
    >
      {iconName ? (
        <Ionicon
          name={iconName}
          size={16}
          className={isActive ? "text-white" : "text-primary-800"}
        />
      ) : null}
      {label}
    </button>
  );

  const filterChipClassName =
    "min-h-[40px] rounded-2xl px-3 py-2 font-semibold";
  const interestLabelByValue = useMemo(() => {
    return new Map(
      interests.map((interest) => [String(interest.value), interest.label])
    );
  }, [interests]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <SearchOutlineIcon
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-800"
            />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={t("Search")}
              className="w-full rounded-full border border-[#EADAF1] py-2 pl-11 pr-4 text-base text-primary-900 outline-none focus:border-secondary-500 sm:text-sm"
              inputMode="search"
              enterKeyHint="search"
            />
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className={`flex h-11 w-11 items-center justify-center rounded-lg border transition ${
              hasFilters
                ? "border-secondary-500 bg-secondary-500 text-white"
                : "border-[#EADAF1] bg-white text-primary-800"
            }`}
            aria-label={t("Filters")}
          >
            <FunnelOutlineIcon
              size={20}
              className={hasFilters ? "text-white" : "text-primary-800"}
            />
          </button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="hide-scrollbar flex flex-1 flex-nowrap items-center gap-2 overflow-x-auto pb-1">
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
                () => setCategory(category.id),
                category?.icon || category?.parent?.icon
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
        <div className="grid gap-5 md:grid-cols-2">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} currentUserId={user?.id} />
          ))}
        </div>
      ) : null}

      {status === "ready" && hasNextPage ? (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-6 text-xs text-secondary-400"
        >
          {isLoadingMore ? t("Loading more...") : ""}
        </div>
      ) : null}

      <Modal
        open={isFilterOpen}
        onClose={() => setFilterOpen(false)}
      >
        <div className="space-y-5 pr-2">
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
              {t("offers.country")}
            </p>
            <select
              value={localFilters.country || ""}
              onChange={(event) => {
                const nextCountry = event.target.value;
                setLocalFilters((prev) => ({
                  ...prev,
                  country: nextCountry || null,
                  city: null
                }));
              }}
              className="min-h-[40px] w-full rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
            >
              <option value="">{t("offers.country_placeholder")}</option>
              {countryOptions.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.label}
                </option>
              ))}
            </select>
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
              disabled={!localFilters.country}
              className="min-h-[40px] w-full rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
            >
              <option value="">
                {localFilters.country
                  ? t("All")
                  : t("offers.city_placeholder_select_country")}
              </option>
              {filteredCities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 border-b border-[#EADAF1] pb-4">
            <p className="text-sm font-semibold text-primary-900">
              {t("participants_count_label")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <p className="text-sm font-semibold text-primary-900">
              {t("organizer_age")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DateTimeField
                label={t("Start date")}
                variant="compact"
                className="space-y-1"
                value={localFilters.start_date_between?.[0] ?? ""}
                onChange={(value) => updateDateRange(0, value)}
              />
              <DateTimeField
                label={t("End date")}
                variant="compact"
                className="space-y-1"
                value={localFilters.start_date_between?.[1] ?? ""}
                onChange={(value) => updateDateRange(1, value)}
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
                  })),
                null,
                filterChipClassName
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
                    })),
                  null,
                  filterChipClassName
                )
              )}
            </div>
          </div>

          <div className="space-y-4 border-b border-[#EADAF1] pb-4">
            <p className="text-sm font-semibold text-primary-900">
              {t("offer_preferences")}
            </p>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-primary-900">
                {t("participants_sex")}
              </p>
              <div className="flex flex-wrap gap-2">
                {renderChip(
                  "sex-all",
                  t("All"),
                  !localFilters.sex,
                  () => setLocalFilters((prev) => ({ ...prev, sex: null })),
                  null,
                  filterChipClassName
                )}
                {renderChip(
                  "sex-male",
                  t("male"),
                  localFilters.sex === "male",
                  () => setLocalFilters((prev) => ({ ...prev, sex: "male" })),
                  null,
                  filterChipClassName
                )}
                {renderChip(
                  "sex-female",
                  t("female"),
                  localFilters.sex === "female",
                  () => setLocalFilters((prev) => ({ ...prev, sex: "female" })),
                  null,
                  filterChipClassName
                )}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-primary-900">
                {t("participants_activity_sector")}
              </p>
              <select
                value=""
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) return;
                  addMultiFilter("interests", value);
                }}
                className="min-h-[40px] w-full rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
              >
                <option value="">{t("Select")}</option>
                {interests.map((interest) => (
                  <option
                    key={interest.value}
                    value={String(interest.value)}
                  >
                    {interest.label}
                  </option>
                ))}
              </select>
              {localFilters.interests?.length ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {localFilters.interests.map((value) => (
                    <button
                      key={`selected-interest-${value}`}
                      type="button"
                      onClick={() => removeMultiFilter("interests", value)}
                      className={`flex items-center gap-2 border border-secondary-500 bg-secondary-500 text-sm font-semibold text-white ${filterChipClassName}`}
                    >
                      <span>{interestLabelByValue.get(value) || value}</span>
                      <span className="text-xs">x</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-primary-900">
                {t("participants_situation")}
              </p>
              <select
                value={localFilters.marital_status || ""}
                onChange={(event) =>
                  setLocalFilters((prev) => ({
                    ...prev,
                    marital_status: event.target.value || null
                  }))
                }
                className="min-h-[40px] w-full rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
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
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            label={t("Validate")}
            className="w-full"
            onClick={handleApplyFilters}
          />
          <Button
            variant="outline"
            label={t("Close")}
            className="w-full"
            onClick={() => setFilterOpen(false)}
          />
        </div>
      </Modal>

      <Link
        href="/app/auth/my-offers/create"
        className="fixed bottom-20 right-4 z-40 flex h-[60px] w-[60px] items-center justify-center rounded-full border border-secondary-500/20 bg-white/80 text-secondary-500 shadow-lg backdrop-blur transition hover:border-secondary-500/30 hover:bg-white"
        aria-label={t("offers.create_offer")}
        title={t("offers.create_offer")}
      >
        <PlusIcon size={28} strokeWidth={2.3} className="text-secondary-500" />
      </Link>
    </div>
  );
}
