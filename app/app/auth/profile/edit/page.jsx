"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import UserAvatar from "../../../../../components/user/user-avatar";
import Button from "../../../../../components/ui/button";
import Input from "../../../../../components/ui/input";
import RadioGroup from "../../../../../components/ui/radio-group";
import Modal from "../../../../../components/ui/modal";
import { useI18n } from "../../../../../components/i18n-provider";
import { apiRequest } from "../../../../lib/api-client";
import { getToken, getUser, setSession } from "../../../../lib/session";

const buildUrl = (path) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  if (path.startsWith("http")) return path;
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
};

const getLanguageHeader = () => {
  if (typeof navigator === "undefined") return "en";
  return navigator.language?.split("-")[0] || "en";
};

const normalizeFieldError = (errors, field) => {
  const value = errors?.[field];
  if (Array.isArray(value)) return value[0];
  return value || "";
};

const normalizeQuestionType = (type) =>
  String(type || "").replace("-", "_");

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

export default function ProfileEditPage() {
  const { t } = useI18n();
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [user, setUser] = useState(() => getUser());
  const [dynamicQuestions, setDynamicQuestions] = useState([]);
  const [formValues, setFormValues] = useState({
    first_name: "",
    last_name: "",
    sex: "male",
    date_of_birth: "",
    bio: "",
    dynamic_questions: {}
  });
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const cropAreaRef = useRef(null);
  const dragStateRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  });
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState("");
  const [cropFile, setCropFile] = useState(null);
  const [cropAreaSize, setCropAreaSize] = useState(0);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [cropMessage, setCropMessage] = useState("");

  const compressAvatarImage = async (file) => {
    const maxDimension = 1024;
    const maxSize = 500 * 1024;
    if (!file || !file.type?.startsWith("image/")) return file;
    if (file.size <= maxSize && file.type !== "image/png") {
      return file;
    }

    const loadImage = async () => {
      if (typeof createImageBitmap === "function") {
        return createImageBitmap(file);
      }
      return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject();
        };
        img.src = objectUrl;
      });
    };

    try {
      const image = await loadImage();
      const width = image.width || image.naturalWidth;
      const height = image.height || image.naturalHeight;
      const maxSide = Math.max(width, height);
      const scale = maxSide > maxDimension ? maxDimension / maxSide : 1;
      const targetWidth = Math.round(width * scale);
      const targetHeight = Math.round(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d");
      if (!context) return file;

      context.drawImage(image, 0, 0, targetWidth, targetHeight);

      const outputType =
        file.type === "image/png" ? "image/png" : "image/jpeg";
      const quality = outputType === "image/jpeg" ? 0.8 : undefined;

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, outputType, quality);
      });

      if (!blob) return file;
      if (blob.size >= file.size && scale === 1) return file;

      return new File([blob], file.name, { type: outputType });
    } catch {
      return file;
    }
  };

  const cleanupCropState = () => {
    setIsCropOpen(false);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    setImageSize({ width: 0, height: 0 });
    setCropAreaSize(0);
    setCropMessage("");
    if (cropImageUrl) {
      URL.revokeObjectURL(cropImageUrl);
    }
    setCropImageUrl("");
    setCropFile(null);
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [userPayload, paramsPayload] = await Promise.all([
          apiRequest("user"),
          apiRequest("parameters", { cacheTime: 300000 })
        ]);
        if (!isMounted) return;
        const loadedUser = userPayload?.data || userPayload;
        const dynamicAnswers = normalizeDynamicAnswers(
          Array.isArray(loadedUser?.dynamic_answers)
            ? {}
            : loadedUser?.dynamic_answers || {}
        );

        setUser(loadedUser);
        setFormValues({
          first_name: loadedUser?.first_name || "",
          last_name: loadedUser?.last_name || "",
          sex: loadedUser?.sex || "male",
          date_of_birth: loadedUser?.date_of_birth || "",
          bio: loadedUser?.bio || "",
          dynamic_questions: dynamicAnswers
        });
        const dynamicGroups = paramsPayload?.dynamic_questions || {};
        setDynamicQuestions(
          dynamicGroups.user || dynamicGroups["App\\\\Models\\\\User"] || []
        );
        setStatus("ready");
      } catch (error) {
        if (!isMounted) return;
        setStatus("error");
        setMessage(error?.message || t("profile.load_error"));
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isCropOpen) return;
    const updateSize = () => {
      if (!cropAreaRef.current) return;
      const rect = cropAreaRef.current.getBoundingClientRect();
      const nextSize = Math.min(rect.width, rect.height);
      setCropAreaSize(nextSize);
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [isCropOpen]);

  useEffect(() => {
    if (!cropImageUrl) return undefined;
    let isActive = true;
    const image = new Image();
    image.onload = () => {
      if (!isActive) return;
      setImageSize({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height
      });
    };
    image.src = cropImageUrl;
    return () => {
      isActive = false;
    };
  }, [cropImageUrl]);

  const baseScale =
    cropAreaSize && imageSize.width
      ? Math.max(
          cropAreaSize / imageSize.width,
          cropAreaSize / imageSize.height
        )
      : 1;
  const cropScale = baseScale * cropZoom;
  const isCropReady = cropAreaSize > 0 && imageSize.width > 0;

  const clampCropOffset = (nextOffset) => {
    if (!isCropReady) {
      return { x: 0, y: 0 };
    }
    const scaledWidth = imageSize.width * cropScale;
    const scaledHeight = imageSize.height * cropScale;
    const maxX = Math.max(0, (scaledWidth - cropAreaSize) / 2);
    const maxY = Math.max(0, (scaledHeight - cropAreaSize) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, nextOffset.x)),
      y: Math.max(-maxY, Math.min(maxY, nextOffset.y))
    };
  };

  useEffect(() => {
    if (!isCropOpen) return;
    setCropOffset((prev) => {
      const clamped = clampCropOffset(prev);
      if (clamped.x === prev.x && clamped.y === prev.y) {
        return prev;
      }
      return clamped;
    });
  }, [cropAreaSize, cropScale, imageSize, isCropOpen]);

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");
    setFieldErrors({});

    const cleanedDynamicQuestions = Object.fromEntries(
      Object.entries(formValues.dynamic_questions || {}).filter(
        ([_, value]) => {
          if (Array.isArray(value)) return value.length > 0;
          return value !== "" && value !== null && value !== undefined;
        }
      )
    );

    const payload = {
      first_name: formValues.first_name.trim(),
      last_name: formValues.last_name.trim(),
      sex: formValues.sex,
      date_of_birth: formValues.date_of_birth || null,
      bio: formValues.bio?.trim() || null,
      dynamic_questions: cleanedDynamicQuestions
    };

    try {
      const response = await apiRequest("profile/profile-information", {
        method: "PUT",
        body: payload
      });
      const updatedUser = response?.data || response;
      const token = getToken();
      if (token) {
        setSession(token, updatedUser);
      }
      setUser(updatedUser);
      router.push("/app/auth/drawer/tabs/profile");
    } catch (error) {
      setMessage(
        error?.data?.message ||
          error?.message ||
          t("profile.update_error")
      );
      setFieldErrors(error?.data?.errors || {});
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const imageUrl = URL.createObjectURL(file);
    setCropFile(file);
    setCropImageUrl(imageUrl);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    setCropMessage("");
    setIsCropOpen(true);
    event.target.value = "";
  };

  const performAvatarUpload = async (file) => {
    setIsUploading(true);
    setCropMessage("");

    try {
      const token = getToken();
      const formData = new FormData();
      const optimizedFile = await compressAvatarImage(file);
      formData.append("avatar", optimizedFile);

      const response = await fetch(buildUrl("profile/avatar"), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Language": getLanguageHeader(),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.message || t("profile.upload_error"));
      }

      const updatedUser = payload?.data || payload;
      const tokenValue = getToken();
      if (tokenValue) {
        setSession(tokenValue, updatedUser);
      }
      setUser(updatedUser);
      return true;
    } catch (error) {
      setCropMessage(error?.message || t("profile.upload_error"));
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const handleCropPointerDown = (event) => {
    if (!isCropReady) return;
    event.preventDefault();
    setIsDragging(true);
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: cropOffset.x,
      originY: cropOffset.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCropPointerMove = (event) => {
    if (!isDragging) return;
    const deltaX = event.clientX - dragStateRef.current.startX;
    const deltaY = event.clientY - dragStateRef.current.startY;
    setCropOffset(
      clampCropOffset({
        x: dragStateRef.current.originX + deltaX,
        y: dragStateRef.current.originY + deltaY
      })
    );
  };

  const handleCropPointerEnd = (event) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleCropConfirm = async () => {
    if (!cropFile || !cropImageUrl || !isCropReady) {
      setCropMessage(t("profile.upload_error"));
      return;
    }

    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject();
        img.src = cropImageUrl;
      });

      const scaledWidth = imageSize.width * cropScale;
      const scaledHeight = imageSize.height * cropScale;
      const imageLeft =
        cropAreaSize / 2 + cropOffset.x - scaledWidth / 2;
      const imageTop =
        cropAreaSize / 2 + cropOffset.y - scaledHeight / 2;
      const cropSize = cropAreaSize / cropScale;
      const cropX = (0 - imageLeft) / cropScale;
      const cropY = (0 - imageTop) / cropScale;
      const clampedCropX = Math.max(
        0,
        Math.min(imageSize.width - cropSize, cropX)
      );
      const clampedCropY = Math.max(
        0,
        Math.min(imageSize.height - cropSize, cropY)
      );
      const outputSize = 512;
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext("2d");
      if (!context) {
        setCropMessage(t("profile.upload_error"));
        return;
      }

      context.drawImage(
        image,
        clampedCropX,
        clampedCropY,
        cropSize,
        cropSize,
        0,
        0,
        outputSize,
        outputSize
      );

      const outputType =
        cropFile.type === "image/png" ? "image/png" : "image/jpeg";
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, outputType, 0.9);
      });
      if (!blob) {
        setCropMessage(t("profile.upload_error"));
        return;
      }

      const croppedFile = new File([blob], cropFile.name, {
        type: outputType
      });
      const success = await performAvatarUpload(croppedFile);
      if (success) {
        cleanupCropState();
      }
    } catch {
      setCropMessage(t("profile.upload_error"));
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary-800">
          {t("profile.edit_profile")}
        </h1>
        <p className="text-sm text-secondary-400">
          {t("profile.edit_profile_information")}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <UserAvatar user={user} size={96} withBorder />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarSelect}
        />
        <Button
          variant="outline"
          size="sm"
          className="px-6"
          label={
            isUploading ? t("profile.uploading") : t("profile.change_photo")
          }
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        />
      </div>

      <Modal
        open={isCropOpen}
        title={t("profile.change_photo")}
        onClose={() => cleanupCropState()}
      >
        <div className="space-y-4">
          <div className="flex justify-center">
            <div
              ref={cropAreaRef}
              className={`relative aspect-square w-full max-w-xs overflow-hidden rounded-3xl bg-neutral-100 shadow-inner sm:max-w-sm ${
                isDragging ? "cursor-grabbing" : "cursor-grab"
              } touch-none`}
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerEnd}
              onPointerCancel={handleCropPointerEnd}
              onPointerLeave={handleCropPointerEnd}
            >
              {cropImageUrl ? (
                <img
                  src={cropImageUrl}
                  alt={t("profile.change_photo")}
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    transform: `translate(-50%, -50%) translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropScale})`,
                    transformOrigin: "center"
                  }}
                />
              ) : null}
              <div className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-white/70" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-secondary-400">-</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={cropZoom}
              onChange={(event) =>
                setCropZoom(Number(event.target.value))
              }
              className="w-full accent-primary-500"
              aria-label={t("Zoom")}
            />
            <span className="text-sm text-secondary-400">+</span>
          </div>

          {cropMessage ? (
            <p className="text-sm text-danger-600">{cropMessage}</p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              label={isUploading ? t("profile.uploading") : t("Confirm")}
              className="w-full"
              onClick={handleCropConfirm}
              disabled={!isCropReady || isUploading}
            />
            <Button
              variant="outline"
              label={t("Cancel")}
              className="w-full"
              onClick={() => cleanupCropState()}
              disabled={isUploading}
            />
          </div>
        </div>
      </Modal>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <p className="mb-2 text-neutral-700">{t("Sex")}</p>
          <RadioGroup
            name="sex"
            options={[
              { label: t("male"), value: "male" },
              { label: t("female"), value: "female" }
            ]}
            value={formValues.sex}
            onChange={(value) => updateField("sex", value)}
          />
          {normalizeFieldError(fieldErrors, "sex") ? (
            <p className="mt-2 text-sm text-danger-600">
              {normalizeFieldError(fieldErrors, "sex")}
            </p>
          ) : null}
        </div>

        <Input
          name="first_name"
          label={t("First Name")}
          value={formValues.first_name}
          onChange={(event) => updateField("first_name", event.target.value)}
          error={normalizeFieldError(fieldErrors, "first_name")}
          required
        />
        <Input
          name="last_name"
          label={t("Last Name")}
          value={formValues.last_name}
          onChange={(event) => updateField("last_name", event.target.value)}
          error={normalizeFieldError(fieldErrors, "last_name")}
          required
        />
        <Input
          name="date_of_birth"
          label={t("date_of_birth")}
          type="date"
          value={formValues.date_of_birth || ""}
          onChange={(event) => updateField("date_of_birth", event.target.value)}
          error={normalizeFieldError(fieldErrors, "date_of_birth")}
        />

        {dynamicQuestions.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-primary-800">
              {t("profile.extra_information")}
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
                      className={`w-full rounded-full border-2 px-4 py-3 text-secondary-400 outline-none focus:border-primary-500 ${
                        error ? "border-danger-600" : "border-[#EADAF1]"
                      }`}
                    >
                      <option value="">{t("Select")}</option>
                      {(question.formatted_settings?.options || []).map(
                        (option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        )
                      )}
                    </select>
                    {error ? (
                      <p className="mt-2 text-sm text-danger-600">{error}</p>
                    ) : null}
                  </div>
                );
              }

              if (questionType === "multi_select") {
                return (
                  <div key={question.id} className="space-y-1">
                    <label className="mb-1 block text-lg text-primary-500">
                      {question.label}
                    </label>
                    <select
                      multiple
                      value={questionValue}
                      onChange={(event) => {
                        const selectedValues = Array.from(
                          event.target.selectedOptions
                        ).map((option) => option.value);
                        updateDynamicQuestion(question.name, selectedValues);
                      }}
                      className={`w-full rounded-2xl border-2 px-4 py-3 text-secondary-400 outline-none focus:border-primary-500 ${
                        error ? "border-danger-600" : "border-[#EADAF1]"
                      }`}
                    >
                      {(question.formatted_settings?.options || []).map(
                        (option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        )
                      )}
                    </select>
                    {error ? (
                      <p className="mt-2 text-sm text-danger-600">{error}</p>
                    ) : null}
                  </div>
                );
              }

              if (questionType === "date") {
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
                  />
                );
              }

              return null;
            })}
          </div>
        ) : null}

        <div className="space-y-1">
          <label className="mb-1 block text-lg text-primary-500">
            {t("bio")}
          </label>
          <textarea
            rows={4}
            value={formValues.bio || ""}
            onChange={(event) => updateField("bio", event.target.value)}
            className={`w-full rounded-2xl border-2 px-4 py-3 text-secondary-400 outline-none focus:border-primary-500 ${
              normalizeFieldError(fieldErrors, "bio")
                ? "border-danger-600"
                : "border-[#EADAF1]"
            }`}
            placeholder={t("profile.bio_placeholder")}
          />
          {normalizeFieldError(fieldErrors, "bio") ? (
            <p className="mt-2 text-sm text-danger-600">
              {normalizeFieldError(fieldErrors, "bio")}
            </p>
          ) : null}
        </div>

        {message ? <p className="text-sm text-danger-600">{message}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            label={t("Cancel")}
            className="w-full"
            onClick={() => router.back()}
          />
          <Button
            type="submit"
            label={
              isSaving ? t("profile.saving") : t("profile.save_changes")
            }
            className="w-full"
            disabled={isSaving}
          />
        </div>
      </form>
    </div>
  );
}
