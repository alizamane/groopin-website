"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import Button from "../../../../../../components/ui/button";
import Checkbox from "../../../../../../components/ui/checkbox";
import DateTimeField from "../../../../../../components/ui/date-time-field";
import Input from "../../../../../../components/ui/input";
import { useI18n } from "../../../../../../components/i18n-provider";
import { apiRequest } from "../../../../../lib/api-client";
import PlaceAutocomplete from "../../../../../../components/offers/place-autocomplete";

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

const renderRequiredLabel = (label) => (
  <span>
    {label} <span className="text-danger-600">*</span>
  </span>
);

const normalizeFieldError = (errors, field) => {
  const value = errors?.[field];
  if (Array.isArray(value)) return value[0];
  return value || "";
};

const normalizeQuestionType = (type) =>
  String(type || "").replace("-", "_");

const normalizeDateForApi = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split("/");
    return `${year}-${month}-${day}`;
  }
  return trimmed;
};

const parseMultiValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item));
        }
      } catch {
        // Ignore JSON parse errors and treat as a single value.
      }
    }
    return trimmed ? [trimmed] : [];
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [String(value)];
};

const isDigitsOnly = (value) => /^\d+$/.test(value);

const normalizeDynamicAnswers = (answers) => {
  if (!answers || typeof answers !== "object") return {};
  return Object.entries(answers).reduce((acc, [key, value]) => {
    if (value === null || value === undefined) return acc;
    if (Array.isArray(value)) {
      acc[key] = value.map((item) => String(item));
      return acc;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            acc[key] = parsed.map((item) => String(item));
            return acc;
          }
        } catch {
          // Ignore JSON parse errors and keep the raw string.
        }
      }
      acc[key] = value;
      return acc;
    }
    acc[key] = String(value);
    return acc;
  }, {});
};

export default function EditMyOfferPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [countryCode, setCountryCode] = useState("");
  const [dynamicQuestions, setDynamicQuestions] = useState([]);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [offer, setOffer] = useState(null);

  const [formValues, setFormValues] = useState({
    title: "",
    category_id: "",
    sub_category_id: "",
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
    city_id: "",
    price: "",
    address: "",
    place_id: "",
    max_participants: "",
    description: "",
    dynamic_questions: {},
    ticketing_enabled: true
  });

  useEffect(() => {
    let isMounted = true;

    const loadFormData = async () => {
      setStatus("loading");
      setMessage("");
      try {
        const [paramsPayload, offerPayload] = await Promise.all([
          apiRequest("parameters", { cacheTime: 300000 }),
          apiRequest(`my-offers/${params.id}`)
        ]);
        if (!isMounted) return;

        const dynamicGroups = paramsPayload?.dynamic_questions || {};
        setCategories(paramsPayload?.categories || []);
        setCities(paramsPayload?.cities || []);
        setDynamicQuestions(
          dynamicGroups.offer || dynamicGroups["App\\\\Models\\\\Offer"] || []
        );

        const offerData = offerPayload?.data || null;
        setOffer(offerData);

        const categoryId = offerData?.category?.id;
        const parentCategoryId = offerData?.category?.parent?.id;
        const mainCategoryId = parentCategoryId || categoryId;
        const subCategoryId = parentCategoryId ? categoryId : "";

        setFormValues({
          title: offerData?.title || "",
          category_id: mainCategoryId ? String(mainCategoryId) : "",
          sub_category_id: subCategoryId ? String(subCategoryId) : "",
          start_date: offerData?.start_date || "",
          start_time: offerData?.start_time || "",
          end_date: offerData?.end_date || "",
          end_time: offerData?.end_time || "",
          city_id: offerData?.city?.id ? String(offerData.city.id) : "",
          price:
            offerData?.price !== null && offerData?.price !== undefined
              ? String(offerData.price)
              : "",
          address:
            offerData?.address ||
            offerData?.place?.name ||
            "",
          place_id: offerData?.place?.id || "",
          max_participants:
            offerData?.max_participants !== null &&
            offerData?.max_participants !== undefined
              ? String(offerData.max_participants)
              : "",
          description: offerData?.description || "",
          dynamic_questions: normalizeDynamicAnswers(
            offerData?.dynamic_answers
          ),
          ticketing_enabled: offerData?.ticketing_enabled !== false
        });

        setStatus("ready");
      } catch (error) {
        if (!isMounted) return;
        setStatus("error");
        setMessage(error?.message || t("general.error_has_occurred"));
      }
    };

    loadFormData();

    return () => {
      isMounted = false;
    };
  }, [params.id, t]);

  const selectedCategory = useMemo(() => {
    const categoryId = Number(formValues.category_id || 0);
    if (!categoryId) return null;
    return categories.find((category) => Number(category.id) === categoryId);
  }, [categories, formValues.category_id]);

  const subCategories = selectedCategory?.children || [];
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
    if (!countryCode) return [];
    return cities.filter(
      (city) =>
        (city.country_code || "MA").toUpperCase() === countryCode
    );
  }, [cities, countryCode]);
  const isDraft = Boolean(offer?.is_draft) || offer?.status === "draft";
  const isTicketingLocked = (offer?.participants_count || 0) > 1;
  const isActionDisabled =
    isSaving ||
    isPublishing ||
    status !== "ready" ||
    isTicketingLocked;

  useEffect(() => {
    if (!cities.length || !formValues.city_id) return;
    const match = cities.find(
      (city) => String(city.id) === String(formValues.city_id)
    );
    if (!match) return;
    const nextCode = (match.country_code || "MA").toUpperCase();
    if (nextCode !== countryCode) {
      setCountryCode(nextCode);
    }
  }, [cities, formValues.city_id, countryCode]);

  useEffect(() => {
    if (!cities.length || countryCode) return;
    const defaultCode =
      (cities[0]?.country_code || "MA").toUpperCase();
    setCountryCode(defaultCode);
  }, [cities, countryCode]);

  const updateField = (field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const updateLocation = (address, placeId) => {
    setFormValues((prev) => ({
      ...prev,
      address,
      place_id: placeId
    }));
  };

  const updateDynamicQuestion = (name, value) => {
    setFormValues((prev) => ({
      ...prev,
      dynamic_questions: {
        ...(prev.dynamic_questions || {}),
        [name]: value
      }
    }));
  };

  const handleCategorySelect = (categoryId) => {
    setFormValues((prev) => ({
      ...prev,
      category_id: String(categoryId),
      sub_category_id: ""
    }));
  };

  const handleSubmit = async (saveAsDraft) => {
    setMessage("");
    setFieldErrors({});
    if (saveAsDraft) {
      setIsSaving(true);
    } else {
      setIsPublishing(true);
    }
    let shouldResetLoading = true;
    const trimmedPrice = String(formValues.price || "").trim();
    if (trimmedPrice && !isDigitsOnly(trimmedPrice)) {
      setFieldErrors({
        price: t("Le budget doit être renseigné en chiffres.")
      });
      setIsSaving(false);
      setIsPublishing(false);
      return;
    }

    const cleanedDynamicQuestions = Object.fromEntries(
      Object.entries(formValues.dynamic_questions || {}).filter(
        ([_, value]) => {
          if (Array.isArray(value)) return value.length > 0;
          return value !== "" && value !== null && value !== undefined;
        }
      )
    );

    const finalCategoryId =
      formValues.sub_category_id || formValues.category_id;
    const normalizedStartDate = normalizeDateForApi(formValues.start_date);
    const normalizedEndDate = normalizeDateForApi(formValues.end_date);

    const trimmedAddress = formValues.address.trim();
    const placeId = formValues.place_id || null;
    const payload = {
      title: formValues.title.trim(),
      category_id: finalCategoryId ? Number(finalCategoryId) : null,
      start_date: normalizedStartDate,
      start_time: formValues.start_time || null,
      end_date: normalizedEndDate,
      end_time: formValues.end_time || null,
      city_id: formValues.city_id ? Number(formValues.city_id) : null,
      price: trimmedPrice ? Number(trimmedPrice) : null,
      address: placeId ? null : trimmedAddress || null,
      place_id: placeId,
      max_participants: formValues.max_participants
        ? Number(formValues.max_participants)
        : null,
      description: formValues.description.trim(),
      dynamic_questions: cleanedDynamicQuestions,
      ticketing_enabled: Boolean(formValues.ticketing_enabled),
      save_as_draft: Boolean(saveAsDraft)
    };

    try {
      await apiRequest(`my-offers/${params.id}`, {
        method: "PUT",
        body: payload
      });

      if (saveAsDraft) {
        setMessage(t("offers.draft_success"));
        shouldResetLoading = false;
        router.push("/app/auth/drawer/tabs/my-offers");
        return;
      }

      shouldResetLoading = false;
      router.push(`/app/auth/my-offers/${params.id}`);
    } catch (error) {
      if (error?.status === 422) {
        const errors = error?.data?.errors || {};
        setFieldErrors(errors);
        setMessage(
          Object.keys(errors).length > 0
            ? t("offers.required_fields_missing")
            : error?.data?.message || t("general.invalid_submission")
        );
      } else {
        setMessage(error?.message || t("offers.update_error"));
      }
    } finally {
      if (shouldResetLoading) {
        setIsSaving(false);
        setIsPublishing(false);
      }
    }
  };

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded-full bg-neutral-100" />
        <div className="h-4 w-64 animate-pulse rounded-full bg-neutral-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-neutral-100" />
      </div>
    );
  }

  if (status === "error") {
    return <p className="text-sm text-danger-600">{message}</p>;
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary-800">
            {isDraft ? t("offers.edit_draft") : t("offers.edit_offer")}
          </h1>
          <p className="text-sm text-secondary-400">
            {t("offers.edit_offer_description")}
          </p>
        </div>
        <Button
          variant="link"
          label={t("Close")}
          onClick={() => router.back()}
        />
      </div>

      {(offer?.participants_count || 0) > 1 ? (
        <p className="text-sm text-danger-600">
          {t("Can not edit if there is more than one participant")}
        </p>
      ) : null}

      <div className="space-y-3">
        <p className="text-sm font-semibold text-primary-800">
          {renderRequiredLabel(t("offers.select_category"))}
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((category, index) => {
            const isActive = Number(formValues.category_id) === category.id;
            const iconName = category?.icon || category?.parent?.icon;
            return (
              <button
                key={category.id ?? `${category.name}-${index}`}
                type="button"
                onClick={() => handleCategorySelect(category.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-normal transition ${
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
                {category.name}
              </button>
            );
          })}
        </div>
        {normalizeFieldError(fieldErrors, "category_id") ? (
          <p className="text-sm text-danger-600">
            {normalizeFieldError(fieldErrors, "category_id")}
          </p>
        ) : null}
      </div>

      {subCategories.length > 0 ? (
        <div className="space-y-1">
          <label className="mb-1 block text-lg text-primary-500">
            {t("offers.sub_category")}
          </label>
          <select
            value={formValues.sub_category_id}
            onChange={(event) =>
              updateField("sub_category_id", event.target.value)
            }
            className="w-full min-h-[52px] rounded-full border-2 border-[#EADAF1] px-4 py-3 text-base leading-6 text-secondary-400 outline-none focus:border-primary-500"
          >
            <option value="">{t("offers.sub_category_placeholder")}</option>
            {subCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <Input
        name="title"
        label={renderRequiredLabel(t("offers.title"))}
        value={formValues.title}
        onChange={(event) => updateField("title", event.target.value)}
        error={normalizeFieldError(fieldErrors, "title")}
        placeholder={t("offers.title_placeholder")}
        required
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1 sm:gap-4">
          <DateTimeField
            name="start_date"
            label={renderRequiredLabel(t("offers.start_date"))}
            value={formValues.start_date}
            onChange={(value) => updateField("start_date", value)}
            error={normalizeFieldError(fieldErrors, "start_date")}
            placeholder={t("offers.start_date_placeholder")}
            required
          />
          <DateTimeField
            name="start_time"
            label={renderRequiredLabel(t("offers.start_time"))}
            type="time"
            value={formValues.start_time}
            onChange={(value) => updateField("start_time", value)}
            error={normalizeFieldError(fieldErrors, "start_time")}
            placeholder={t("offers.start_time_placeholder")}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1 sm:gap-4">
          <DateTimeField
            name="end_date"
            label={renderRequiredLabel(t("offers.end_date"))}
            value={formValues.end_date}
            onChange={(value) => updateField("end_date", value)}
            error={normalizeFieldError(fieldErrors, "end_date")}
            placeholder={t("offers.end_date_placeholder")}
            required
          />
          <DateTimeField
            name="end_time"
            label={renderRequiredLabel(t("offers.end_time"))}
            type="time"
            value={formValues.end_time}
            onChange={(value) => updateField("end_time", value)}
            error={normalizeFieldError(fieldErrors, "end_time")}
            placeholder={t("offers.end_time_placeholder")}
            required
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="mb-1 block text-lg text-primary-500">
          {renderRequiredLabel(t("offers.country"))}
        </label>
        <select
          value={countryCode}
          onChange={(event) => {
            const nextCountry = event.target.value;
            setCountryCode(nextCountry);
            updateField("city_id", "");
          }}
          className={`w-full min-h-[52px] rounded-full border-2 px-4 py-3 text-base leading-6 text-secondary-400 outline-none focus:border-primary-500 ${
            normalizeFieldError(fieldErrors, "city_id")
              ? "border-danger-600"
              : "border-[#EADAF1]"
          }`}
          required
        >
          <option value="">{t("offers.country_placeholder")}</option>
          {countryOptions.map((country) => (
            <option key={country.code} value={country.code}>
              {country.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="mb-1 block text-lg text-primary-500">
          {renderRequiredLabel(t("offers.city"))}
        </label>
        <select
          value={formValues.city_id}
          onChange={(event) => updateField("city_id", event.target.value)}
          disabled={!countryCode}
          className={`w-full min-h-[52px] rounded-full border-2 px-4 py-3 text-base leading-6 text-secondary-400 outline-none focus:border-primary-500 ${
            normalizeFieldError(fieldErrors, "city_id")
              ? "border-danger-600"
              : "border-[#EADAF1]"
          }`}
          required
        >
          <option value="">
            {countryCode
              ? t("offers.city_placeholder")
              : t("offers.city_placeholder_select_country")}
          </option>
          {filteredCities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
        {normalizeFieldError(fieldErrors, "city_id") ? (
          <p className="text-sm text-danger-600">
            {normalizeFieldError(fieldErrors, "city_id")}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <PlaceAutocomplete
          label={renderRequiredLabel(t("offers.address"))}
          value={formValues.address}
          onChange={(nextValue) => updateLocation(nextValue, "")}
          onSelect={({ placeId, description }) =>
            updateLocation(description, placeId || "")
          }
          error={
            normalizeFieldError(fieldErrors, "place_id") ||
            normalizeFieldError(fieldErrors, "address")
          }
          placeholder={t("offers.location_placeholder")}
          countryCode={countryCode}
          required
        />
        {formValues.place_id ? (
          <button
            type="button"
            onClick={() => updateLocation(formValues.address, "")}
            className="text-xs text-secondary-400 underline"
          >
            {t("offers.location_clear")}
          </button>
        ) : (
          <p className="text-xs text-secondary-400">
            {t("offers.location_hint")}
          </p>
        )}
      </div>

      <Input
        name="price"
        label={t("offers.price")}
        type="text"
        value={formValues.price}
        onChange={(event) => {
          const nextValue = event.target.value;
          updateField("price", nextValue);
          const trimmedValue = nextValue.trim();
          if (!trimmedValue || isDigitsOnly(trimmedValue)) {
            setFieldErrors((prev) => {
              if (!prev?.price) return prev;
              const { price: _price, ...rest } = prev || {};
              return rest;
            });
          }
        }}
        error={normalizeFieldError(fieldErrors, "price")}
        placeholder={t("offers.price_placeholder")}
        inputMode="numeric"
        pattern="[0-9]*"
      />

      <Input
        name="max_participants"
        label={t("offers.max_participants")}
        type="number"
        value={formValues.max_participants}
        onChange={(event) =>
          updateField("max_participants", event.target.value)
        }
        error={normalizeFieldError(fieldErrors, "max_participants")}
        placeholder={t("offers.max_participants_placeholder")}
      />

      <div className="rounded-2xl border border-[#EADAF1] bg-white p-4">
        <Checkbox
          label={t("offers.ticketing_label")}
          checked={Boolean(formValues.ticketing_enabled)}
          onChange={(nextValue) => updateField("ticketing_enabled", nextValue)}
          disabled={isTicketingLocked}
        />
        <p className="mt-2 text-xs text-secondary-400">
          {t("offers.ticketing_hint")}
        </p>
      </div>

      <div className="space-y-1">
        <label className="mb-1 block text-lg text-primary-500">
          {renderRequiredLabel(t("offers.description"))}
        </label>
        <textarea
          rows={4}
          value={formValues.description}
          onChange={(event) => updateField("description", event.target.value)}
          className={`w-full rounded-2xl border-2 px-4 py-3 text-secondary-400 outline-none focus:border-primary-500 ${
            normalizeFieldError(fieldErrors, "description")
              ? "border-danger-600"
              : "border-[#EADAF1]"
          }`}
          placeholder={t("offers.description_placeholder")}
          required
        />
        {normalizeFieldError(fieldErrors, "description") ? (
          <p className="text-sm text-danger-600">
            {normalizeFieldError(fieldErrors, "description")}
          </p>
        ) : null}
      </div>

      {dynamicQuestions.length > 0 ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-primary-800">
            {t("offers.extra_questions")}
          </p>
          {dynamicQuestions.map((question) => {
            const questionType = normalizeQuestionType(question.type);
            const rawQuestionValue =
              formValues.dynamic_questions?.[question.name];
            const questionValue =
              questionType === "multi_select"
                ? parseMultiValue(rawQuestionValue)
                : rawQuestionValue ?? "";
            const error = normalizeFieldError(
              fieldErrors,
              `dynamic_questions.${question.name}`
            );

            if (question.type === "text") {
              return (
                <Input
                  key={question.id}
                  label={question.label}
                  value={questionValue}
                  onChange={(event) =>
                    updateDynamicQuestion(question.name, event.target.value)
                  }
                  error={error}
                />
              );
            }

            if (questionType === "select" || questionType === "select_buttons") {
              return (
                <div key={question.id} className="space-y-1">
                  <label className="mb-1 block text-lg text-primary-500">
                    {question.label}
                  </label>
                  <select
                    value={questionValue}
                    onChange={(event) =>
                      updateDynamicQuestion(question.name, event.target.value)
                    }
                    className={`w-full min-h-[52px] rounded-full border-2 px-4 py-3 text-base leading-6 text-secondary-400 outline-none focus:border-primary-500 ${
                      error ? "border-danger-600" : "border-[#EADAF1]"
                    }`}
                  >
                    <option value="">{t("select_option")}</option>
                    {(question.formatted_settings?.options || []).map(
                      (option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      )
                    )}
                  </select>
                  {error ? (
                    <p className="text-sm text-danger-600">{error}</p>
                  ) : null}
                </div>
              );
            }

            if (questionType === "multi_select") {
              const options = question.formatted_settings?.options || [];
              const optionLabelByValue = new Map(
                options.map((option) => [String(option.value), option.label])
              );
              return (
                <div key={question.id} className="space-y-1">
                  <label className="mb-1 block text-lg text-primary-500">
                    {question.label}
                  </label>
                  <select
                    value=""
                    onChange={(event) => {
                      const value = String(event.target.value || "");
                      if (!value || questionValue.includes(value)) return;
                      updateDynamicQuestion(question.name, [
                        ...questionValue,
                        value
                      ]);
                    }}
                    className="min-h-[52px] w-full rounded-full border-2 border-[#EADAF1] px-4 py-3 text-base leading-6 text-secondary-400 outline-none focus:border-primary-500"
                  >
                    <option value="">{t("offers.multi_select_placeholder")}</option>
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {questionValue.length ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {questionValue.map((value) => (
                        <button
                          key={`selected-${question.id}-${value}`}
                          type="button"
                          onClick={() =>
                            updateDynamicQuestion(
                              question.name,
                              questionValue.filter((item) => item !== value)
                            )
                          }
                          className="flex min-h-[52px] items-center gap-2 rounded-full border border-secondary-500 bg-secondary-500 px-4 py-3 text-base font-semibold text-white"
                        >
                          <span>{optionLabelByValue.get(value) || value}</span>
                          <span className="text-xs">x</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {error ? (
                    <p className="text-sm text-danger-600">{error}</p>
                  ) : null}
                </div>
              );
            }

            if (questionType === "date") {
              return (
                <DateTimeField
                  key={question.id}
                  label={question.label}
                  type="date"
                  value={questionValue || ""}
                  onChange={(value) =>
                    updateDynamicQuestion(question.name, value)
                  }
                  error={error}
                />
              );
            }

            return null;
          })}
        </div>
      ) : null}

      {message ? <p className="text-sm text-danger-600">{message}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        {isDraft ? (
          <>
            <Button
              type="button"
              variant="outline"
              label={
                isSaving
                  ? `${t("offers.save_draft")}...`
                  : t("offers.save_draft")
              }
              className="w-full"
              onClick={() => handleSubmit(true)}
              disabled={isActionDisabled}
            />
            <Button
              type="button"
              label={
                isPublishing
                  ? `${t("offers.create")}...`
                  : t("offers.create")
              }
              className="w-full"
              onClick={() => handleSubmit(false)}
              disabled={isActionDisabled}
            />
          </>
        ) : (
          <Button
            type="button"
            label={
              isPublishing
                ? `${t("offers.save_changes")}...`
                : t("offers.save_changes")
            }
            className="w-full"
            onClick={() => handleSubmit(false)}
            disabled={isActionDisabled}
          />
        )}
      </div>
    </div>
  );
}


