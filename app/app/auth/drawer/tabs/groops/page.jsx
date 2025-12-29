"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

import { apiRequest } from "../../../../../lib/api-client";
import UsersAvatarsList from "../../../../../../components/user/users-avatars-list";
import { useI18n } from "../../../../../../components/i18n-provider";

const formatDate = (value, locale) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric"
  });
};

const truncate = (text, limit = 24) => {
  if (!text) return "";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
};

export default function GroopsPage() {
  const { t, locale } = useI18n();
  const [conversations, setConversations] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const dateLocale =
    locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-MA" : "en-US";

  useEffect(() => {
    setStatus("loading");
    apiRequest("conversations?lite=1", { cache: false })
      .then((payload) => {
        const data = payload?.data || [];
        const sorted = [...data].sort((a, b) => {
          return (
            new Date(b.last_message_at).getTime() -
            new Date(a.last_message_at).getTime()
          );
        });
        setConversations(sorted);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err?.message || t("general.error_has_occurred"));
        setStatus("error");
      });
  }, [t]);

  return (
    <div className="space-y-4">
      {status === "loading" ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="h-24 animate-pulse rounded-2xl bg-neutral-100"
            />
          ))}
        </div>
      ) : null}

      {status === "error" ? (
        <p className="text-sm text-danger-600">{error}</p>
      ) : null}

      {status === "ready" && conversations.length === 0 ? (
        <p className="text-sm text-secondary-400">{t("nothingToShow")}</p>
      ) : null}

      {status === "ready" ? (
        <div className="space-y-3">
          {conversations.map((conversation) => {
            const hasUnread =
              conversation.has_unread_messages_count &&
              conversation.has_unread_messages_count > 0;
            const participants = conversation?.offer?.participants || [];
            const participantsCount =
              conversation?.offer?.participants_count ?? participants.length;

            return (
              <Link
                key={conversation.id}
                href={`/app/auth/conversations/${conversation.id}`}
                className={`flex items-start gap-4 overflow-hidden rounded-2xl border border-[#EADAF1] px-4 py-4 transition ${
                  hasUnread ? "bg-[#F7F1FA]" : "bg-white"
                }`}
              >
                <div className="pt-1">
                  <UsersAvatarsList
                    users={participants}
                    lastItemText={participantsCount ? `${participantsCount}` : ""}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-primary-900">
                        {conversation?.offer?.title || t("Groops")}
                      </p>
                      <p className="mt-1 text-sm text-secondary-400 line-clamp-2 break-words">
                        {truncate(
                          conversation?.last_message?.automatic
                            ? ""
                            : conversation?.last_message?.user?.name
                            ? `${conversation.last_message.user.name}: `
                            : ""
                        )}
                        {truncate(conversation?.last_message?.content, 32)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs text-secondary-400">
                        {formatDate(conversation.last_message_at, dateLocale)}
                      </span>
                      {hasUnread ? (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-500 text-xs text-white">
                          {conversation.unread_messages || ""}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
