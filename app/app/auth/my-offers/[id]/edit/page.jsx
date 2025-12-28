"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import Button from "../../../../../../components/ui/button";
import Input from "../../../../../../components/ui/input";
import { useI18n } from "../../../../../../components/i18n-provider";
import { apiRequest } from "../../../../../lib/api-client";

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

const normalizeDynamicAnswers = (answers) => {
  if (!answers || typeof answers !== "object") return {};
  return Object.entries(answers).reduce((acc, [key, value]) => {
    if (value === null || value === undefined) return acc;
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
    max_participants: "",
    description: "",
    dynamic_questions: {}
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
          address: offerData?.address || "",
          max_participants:
            offerData?.max_participants !== null &&
            offerData?.max_participants !== undefined
              ? String(offerData.max_participants)
              : "",
          description: offerData?.description || "",
          dynamic_questions: normalizeDynamicAnswers(
            offerData?.dynamic_answers
          )
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
  const isDraft = Boolean(offer?.is_draft) || offer?.status === "draft";
  const isActionDisabled =
    isSaving ||
    isPublishing ||
    status !== "ready" ||
    (offer?.participants_count || 0) > 1;

  const updateField = (field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
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

    const cleanedDynamicQuestions = Object.fromEntries(
      Object.entries(formValues.dynamic_questions || {}).filter(
        ([_, value]) => value !== "" && value !== null && value !== undefined
      )
    );

    const finalCategoryId =
      formValues.sub_category_id || formValues.category_id;

    const payload = {
      title: formValues.title.trim(),
      category_id: finalCategoryId ? Number(finalCategoryId) : null,
      start_date: formValues.start_date || null,
      start_time: formValues.start_time || null,
      end_date: formValues.end_date || null,
      end_time: formValues.end_time || null,
      city_id: formValues.city_id ? Number(formValues.city_id) : null,
      price: formValues.price ? Number(formValues.price) : null,
      address: formValues.address.trim(),
      max_participants: formValues.max_participants
        ? Number(formValues.max_participants)
        : null,
      description: formValues.description.trim(),
      dynamic_questions: cleanedDynamicQuestions,
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

      <div className="grid gap-4 md:grid-cols-2">
        <Input
          name="start_date"
          label={renderRequiredLabel(t("offers.start_date"))}
          type="date"
          value={formValues.start_date}
          onChange={(event) => updateField("start_date", event.target.value)}
          error={normalizeFieldError(fieldErrors, "start_date")}
          inputClassName="brand-picker"
          placeholder={t("offers.start_date_placeholder")}
          required
        />
        <Input
          name="start_time"
          label={renderRequiredLabel(t("offers.start_time"))}
          type="time"
          value={formValues.start_time}
          onChange={(event) => updateField("start_time", event.target.value)}
          error={normalizeFieldError(fieldErrors, "start_time")}
          inputClassName="brand-picker"
          placeholder={t("offers.start_time_placeholder")}
          required
        />
        <Input
          name="end_date"
          label={renderRequiredLabel(t("offers.end_date"))}
          type="date"
          value={formValues.end_date}
          onChange={(event) => updateField("end_date", event.target.value)}
          error={normalizeFieldError(fieldErrors, "end_date")}
          inputClassName="brand-picker"
          placeholder={t("offers.end_date_placeholder")}
          required
        />
        <Input
          name="end_time"
          label={renderRequiredLabel(t("offers.end_time"))}
          type="time"
          value={formValues.end_time}
          onChange={(event) => updateField("end_time", event.target.value)}
          error={normalizeFieldError(fieldErrors, "end_time")}
          inputClassName="brand-picker"
          placeholder={t("offers.end_time_placeholder")}
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="mb-1 block text-lg text-primary-500">
            {renderRequiredLabel(t("offers.city"))}
          </label>
          <select
            value={formValues.city_id}
            onChange={(event) => updateField("city_id", event.target.value)}
            className={`w-full min-h-[52px] rounded-full border-2 px-4 py-3 text-base leading-6 text-secondary-400 outline-none focus:border-primary-500 ${
              normalizeFieldError(fieldErrors, "city_id")
                ? "border-danger-600"
                : "border-[#EADAF1]"
            }`}
            required
          >
            <option value="">{t("offers.city_placeholder")}</option>
            {cities.map((city) => (
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
        <Input
          name="price"
          label={t("offers.price")}
          type="number"
          value={formValues.price}
          onChange={(event) => updateField("price", event.target.value)}
          error={normalizeFieldError(fieldErrors, "price")}
          placeholder={t("offers.price_placeholder")}
        />
      </div>

      <Input
        name="address"
        label={renderRequiredLabel(t("offers.address"))}
        value={formValues.address}
        onChange={(event) => updateField("address", event.target.value)}
        error={normalizeFieldError(fieldErrors, "address")}
        placeholder={t("offers.address_placeholder")}
        required
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
            const questionValue =
              formValues.dynamic_questions?.[question.name] ?? "";
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

            if (question.type === "select" || question.type === "select_buttons") {
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

            if (question.type === "date") {
              return (
                <Input
                  key={question.id}
                  label={question.label}
                  type="date"
                  value={questionValue || ""}
                  onChange={(event) =>
                    updateDynamicQuestion(question.name, event.target.value)
                  }
                  error={error}
                  inputClassName="brand-picker"
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


