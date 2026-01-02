"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import Button from "../../../../../components/ui/button";
import Modal from "../../../../../components/ui/modal";
import UserAvatar from "../../../../../components/user/user-avatar";
import { ArrowLeftIcon, CheckIcon, PaperAirplaneIcon } from "../../../../../components/ui/heroicons";
import { useI18n } from "../../../../../components/i18n-provider";
import { apiRequest } from "../../../../lib/api-client";
import { getEcho } from "../../../../lib/realtime-client";
import { getUser } from "../../../../lib/session";

const formatDay = (value, locale) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric"
  });
};

const formatTime = (value, locale) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit"
  });
};

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  const [sendState, setSendState] = useState("idle");
  const [sendError, setSendError] = useState("");
  const [conversation, setConversation] = useState(null);
  const [readStates, setReadStates] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isSeenModalOpen, setSeenModalOpen] = useState(false);
  const currentUser = getUser();
  const currentUserId =
    currentUser?.id !== null && currentUser?.id !== undefined
      ? Number(currentUser.id)
      : null;
  const bottomRef = useRef(null);
  const firstScrollRef = useRef(true);
  const messagesRef = useRef([]);
  const lastRemoteSignatureRef = useRef("");
  const lastConversationStampRef = useRef("");
  const lastReadSentRef = useRef(0);
  const typingTimeoutRef = useRef(null);
  const typingSentAtRef = useRef(0);
  const typingStateRef = useRef(false);
  const typingCleanupRef = useRef(new Map());
  const dateLocale =
    locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-MA" : "en-US";

  const buildMessageSignature = (items) => {
    if (!items || items.length === 0) return "empty";
    const first = items[0];
    const last = items[items.length - 1];
    return `${items.length}:${first?.id || ""}:${last?.id || ""}:${
      last?.created_at || ""
    }`;
  };

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const normalizeMessage = (message) => {
    if (!message) return null;
    return {
      id: message.id,
      content: message.content,
      type: message.type,
      automatic: Boolean(message.automatic),
      created_at: message.created_at,
      user: message.user
        ? {
            id: message.user.id,
            first_name: message.user.first_name,
            last_name: message.user.last_name,
            name: message.user.name
          }
        : null
    };
  };

  const mergeIncomingMessage = (incoming) => {
    if (!incoming?.id) return;
    setMessages((prev) => {
      if (prev.some((message) => message.id === incoming.id)) {
        return prev;
      }
      return [...prev, incoming];
    });
  };

  const fetchMessages = async () => {
    setStatus("loading");
    try {
      const payload = await apiRequest(
        `conversations/${params.id}/messages?lite=1`,
        { cache: false }
      );
      const remoteMessages = payload?.data || [];
      const conversationData = payload?.meta?.conversation || null;
      const remoteReadStates = payload?.meta?.read_states || [];
      lastRemoteSignatureRef.current = buildMessageSignature(remoteMessages);
      lastConversationStampRef.current =
        conversationData?.last_message_at || "";
      setMessages(remoteMessages);
      setConversation(conversationData);
      setReadStates(remoteReadStates);
      setError("");
      setStatus("ready");
    } catch (err) {
      setError(err?.message || t("general.error_has_occurred"));
      setStatus("error");
    }
  };

  const refreshMessages = async () => {
    try {
      const payload = await apiRequest(
        `conversations/${params.id}/messages?lite=1`,
        { cache: false }
      );
      const remoteMessages = payload?.data || [];
      const conversationData = payload?.meta?.conversation || null;
      const remoteReadStates = payload?.meta?.read_states || [];
      const remoteSignature = buildMessageSignature(remoteMessages);
      const conversationStamp = conversationData?.last_message_at || "";
      const hasTempMessages = messagesRef.current.some(
        (message) => message?.isTemp
      );

      if (
        !hasTempMessages &&
        remoteSignature === lastRemoteSignatureRef.current
      ) {
        if (
          conversationStamp &&
          conversationStamp !== lastConversationStampRef.current
        ) {
          setConversation(conversationData);
          lastConversationStampRef.current = conversationStamp;
        }
        setReadStates(remoteReadStates);
        setStatus((prev) => (prev === "error" ? "ready" : prev));
        return;
      }

      setConversation(conversationData);
      setMessages((prev) => {
        const tempMessages = prev.filter((message) => message?.isTemp);
        if (!tempMessages.length) return remoteMessages;
        const filteredTemps = tempMessages.filter((temp) => {
          return !remoteMessages.some((remote) => {
            if (remote?.automatic) return false;
            if (remote?.user?.id !== temp?.user?.id) return false;
            if (remote?.content !== temp?.content) return false;
            const tempTime = new Date(temp.created_at).getTime();
            const remoteTime = new Date(remote.created_at).getTime();
            return Math.abs(remoteTime - tempTime) < 15000;
          });
        });
        return [...remoteMessages, ...filteredTemps];
      });
      setReadStates(remoteReadStates);
      lastRemoteSignatureRef.current = remoteSignature;
      lastConversationStampRef.current = conversationStamp;
      setError("");
      setStatus((prev) => (prev === "error" ? "ready" : prev));
    } catch {
      // Silent refresh; keep current UI state.
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [params.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshMessages();
    }, 6000);

    return () => clearInterval(interval);
  }, [params.id]);

  useEffect(() => {
    if (!currentUserId) return undefined;
    const echo = getEcho();
    if (!echo) return undefined;

    const channelName = `App.Models.User.${currentUserId}`;
    const channel = echo.private(channelName);

    channel.listen(".message:created", (event) => {
      const incoming = normalizeMessage(event?.message || event);
      const conversationId =
        event?.conversation_id ||
        event?.message?.conversation?.id ||
        event?.message?.conversation_id;
      if (Number(conversationId) !== Number(params.id)) return;
      if (!incoming) return;
      mergeIncomingMessage(incoming);
    });

    channel.listen(".message:read", (event) => {
      if (Number(event?.conversation_id) !== Number(params.id)) return;
      const reader = event?.user || {};
      if (!reader?.id) return;
      setReadStates((prev) => {
        const next = prev.filter(
          (item) => Number(item.id) !== Number(reader.id)
        );
        next.push({
          id: reader.id,
          first_name: reader.first_name,
          last_name: reader.last_name,
          name: reader.name,
          avatar_image_url: reader.avatar_image_url,
          uses_default_image: reader.uses_default_image,
          last_read_message_id: event?.message_id ?? null,
          last_read_at: event?.read_at ?? null
        });
        return next;
      });
    });

    channel.listen(".message:typing", (event) => {
      if (Number(event?.conversation_id) !== Number(params.id)) return;
      const typingUser = event?.user;
      if (!typingUser?.id || Number(typingUser.id) === currentUserId) return;
      const isTyping = Boolean(event?.is_typing);

      setTypingUsers((prev) => {
        const filtered = prev.filter((user) => user.id !== typingUser.id);
        return isTyping ? [...filtered, typingUser] : filtered;
      });

      const timers = typingCleanupRef.current;
      const existingTimer = timers.get(typingUser.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        timers.delete(typingUser.id);
      }
      if (isTyping) {
        const timeoutId = setTimeout(() => {
          setTypingUsers((prev) =>
            prev.filter((user) => user.id !== typingUser.id)
          );
          timers.delete(typingUser.id);
        }, 3500);
        timers.set(typingUser.id, timeoutId);
      }
    });

    return () => {
      echo.leave(`private-${channelName}`);
    };
  }, [currentUserId, params.id]);

  const offer = conversation?.offer;
  const offerOwnerId = offer?.owner?.id || offer?.owner_id;
  const offerHref = offer
    ? Number(offerOwnerId) === currentUserId
      ? `/app/auth/my-offers/${offer.id}`
      : `/app/auth/offers/${offer.id}`
    : "";

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [messages]);

  const lastOutgoingMessageId = useMemo(() => {
    for (let index = sortedMessages.length - 1; index >= 0; index -= 1) {
      const message = sortedMessages[index];
      if (!message || message.isTemp || message.automatic) continue;
      if (Number(message?.user?.id) === currentUserId) {
        return message.id;
      }
    }
    return null;
  }, [sortedMessages, currentUser?.id]);

  const lastOutgoingSeen = useMemo(() => {
    if (!lastOutgoingMessageId) return false;
    const lastId = Number(lastOutgoingMessageId);
    if (!Number.isFinite(lastId)) return false;
    const otherReaders = readStates.filter(
      (user) => Number(user.id) !== currentUserId
    );
    if (!otherReaders.length) return false;
    return otherReaders.every((user) => {
      const readId = Number(user.last_read_message_id || 0);
      return readId >= lastId;
    });
  }, [lastOutgoingMessageId, readStates, currentUserId]);

  const seenByUsers = useMemo(() => {
    if (!lastOutgoingMessageId) return [];
    const lastId = Number(lastOutgoingMessageId);
    if (!Number.isFinite(lastId)) return [];
    return readStates
      .filter((user) => Number(user.id) !== currentUserId)
      .filter((user) => Number(user.last_read_message_id || 0) >= lastId)
      .sort((a, b) => {
        const aTime = a.last_read_at ? new Date(a.last_read_at).getTime() : 0;
        const bTime = b.last_read_at ? new Date(b.last_read_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [lastOutgoingMessageId, readStates, currentUserId]);

  const seenSummary = useMemo(() => {
    if (!seenByUsers.length) return "";
    const names = seenByUsers.map((user) => {
      return user.first_name || user.name || "";
    }).filter(Boolean);
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }, [seenByUsers]);

  const allSeen = useMemo(() => {
    if (!lastOutgoingMessageId) return false;
    const otherReaders = readStates.filter(
      (user) => Number(user.id) !== currentUserId
    );
    if (!otherReaders.length) return false;
    return seenByUsers.length === otherReaders.length;
  }, [lastOutgoingMessageId, readStates, currentUserId, seenByUsers.length]);

  const seenToneClass = allSeen ? "text-secondary-600" : "text-secondary-300";

  useEffect(() => {
    if (!bottomRef.current) return;
    const behavior = firstScrollRef.current ? "auto" : "smooth";
    bottomRef.current.scrollIntoView({ behavior, block: "end" });
    firstScrollRef.current = false;
  }, [sortedMessages.length]);

  const sendTyping = async (isTyping) => {
    if (!currentUser?.id) return;
    if (typingStateRef.current === isTyping) return;
    typingStateRef.current = isTyping;
    try {
      await apiRequest(`conversations/${params.id}/typing`, {
        method: "POST",
        body: { is_typing: Boolean(isTyping) }
      });
    } catch {
      // Ignore typing errors.
    }
  };

  const scheduleTyping = (nextValue) => {
    const trimmed = nextValue.trim();
    if (!trimmed) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      sendTyping(false);
      return;
    }

    const now = Date.now();
    if (now - typingSentAtRef.current > 2000) {
      typingSentAtRef.current = now;
      sendTyping(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendTyping(false);
    };
  }, [params.id, currentUser?.id]);

  const markRead = async (messageId) => {
    if (!currentUserId) return;
    const numericId = Number(messageId);
    if (!Number.isFinite(numericId) || numericId <= 0) return;
    if (numericId <= lastReadSentRef.current) return;
    lastReadSentRef.current = numericId;
    try {
      const payload = await apiRequest(`conversations/${params.id}/read`, {
        method: "POST",
        body: { message_id: numericId }
      });
      const readData = payload?.data;
      if (readData?.message_id) {
        setReadStates((prev) => {
          const next = prev.filter(
            (user) => Number(user.id) !== currentUserId
          );
          next.push({
            id: currentUserId,
            first_name: currentUser?.first_name,
            last_name: currentUser?.last_name,
            name: currentUser?.name,
            avatar_image_url: currentUser?.avatar_image_url,
            uses_default_image: currentUser?.uses_default_image,
            last_read_message_id: readData.message_id,
            last_read_at: readData.read_at
          });
          return next;
        });
      }
    } catch {
      // Ignore read receipt errors.
    }
  };

  useEffect(() => {
    const lastMessage = sortedMessages[sortedMessages.length - 1];
    if (!lastMessage || lastMessage.isTemp) return;
    if (!lastMessage.id) return;
    markRead(lastMessage.id);
  }, [sortedMessages, params.id, currentUserId]);

  const handleSend = async (event) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sendState !== "idle") return;
    setSendState("sending");
    setSendError("");
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      content: trimmed,
      created_at: new Date().toISOString(),
      automatic: false,
      isTemp: true,
      user: {
        id: currentUserId || tempId,
        first_name: currentUser?.first_name || "You"
      }
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setContent("");
    sendTyping(false);
    try {
      const response = await apiRequest(
        `conversations/${params.id}/messages?lite=1`,
        {
          method: "POST",
          body: { content: trimmed }
        }
      );
      const newMessage = normalizeMessage(response?.data || null);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === tempId
            ? newMessage || { ...message, isTemp: false }
            : message
        )
      );
    } catch (err) {
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      setSendError(err?.message || t("general.error_has_occurred"));
    } finally {
      setSendState("idle");
    }
  };

  return (
    <div className="flex h-[calc(100dvh-12rem)] flex-col gap-4 overflow-hidden">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#EADAF1] text-secondary-600 transition hover:bg-[#F7F1FA]"
          aria-label={t("Close")}
        >
          <ArrowLeftIcon size={20} className="text-secondary-600" />
        </button>
        {offer && offerHref ? (
          <Link
            href={offerHref}
            className="flex-1 truncate rounded-full bg-[#F7F1FA] px-4 py-2 text-sm font-semibold text-primary-700"
          >
            {offer.title}
          </Link>
        ) : (
          <p className="text-sm font-semibold text-primary-900">
            {t("Groops")}
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-[#EADAF1] bg-white p-4">
        <div className="flex-1 overflow-y-auto pr-2">
          {status === "loading" ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`message-skeleton-${index}`}
                  className="h-16 animate-pulse rounded-2xl bg-neutral-100"
                />
              ))}
            </div>
          ) : null}

          {status === "error" ? (
            <p className="text-sm text-danger-600">{error}</p>
          ) : null}

          {status === "ready" && sortedMessages.length === 0 ? (
            <p className="text-sm text-secondary-400">{t("nothingToShow")}</p>
          ) : null}

          {status === "ready" && sortedMessages.length > 0 ? (
            <div className="space-y-4">
              {(() => {
                let lastDate = "";
                return sortedMessages.map((message) => {
                  const dateKey = message?.created_at?.split("T")[0] || "";
                  const showDate = dateKey && dateKey !== lastDate;
                  if (showDate) {
                    lastDate = dateKey;
                  }
                  const isMine = message?.user?.id === currentUser?.id;
                  const isTemp = Boolean(message?.isTemp);
                  if (message?.automatic) {
                    return (
                      <div key={message.id} className="space-y-2">
                        {showDate ? (
                          <div className="flex justify-center">
                            <span className="rounded-full bg-[#F7F1FA] px-3 py-1 text-xs text-secondary-500">
                              {formatDay(message.created_at, dateLocale)}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex justify-center">
                          <span className="text-xs text-secondary-400">
                            {message.content}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={message.id} className="space-y-2">
                      {showDate ? (
                        <div className="flex justify-center">
                            <span className="rounded-full bg-[#F7F1FA] px-3 py-1 text-xs text-secondary-500">
                              {formatDay(message.created_at, dateLocale)}
                            </span>
                          </div>
                        ) : null}
                      <div
                        className={`flex ${
                          isMine ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                            isMine
                              ? "bg-[#EADAF1] text-primary-900"
                              : "bg-[#F4F4F5] text-secondary-700"
                          } ${isTemp ? "opacity-70" : ""}`}
                        >
                          {!isMine ? (
                            <p className="text-xs font-semibold text-primary-900">
                              {message?.user?.first_name || ""}
                            </p>
                          ) : null}
                          <p className="mt-1 text-sm leading-relaxed">
                            {message.content}
                          </p>
                          <p className="mt-2 text-[11px] text-secondary-400">
                            {isTemp
                              ? t("Loading more...")
                              : formatTime(message.created_at, dateLocale)}
                          </p>
                          {isMine &&
                          !isTemp &&
                          message.id === lastOutgoingMessageId ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (seenByUsers.length) {
                                  setSeenModalOpen(true);
                                }
                              }}
                              className={`mt-2 flex items-center gap-2 text-[11px] ${seenToneClass} ${
                                seenByUsers.length ? "cursor-pointer" : ""
                              }`}
                              disabled={!seenByUsers.length}
                            >
                              <span className="relative inline-flex h-3 w-5 items-center justify-center">
                                <CheckIcon
                                  size={14}
                                  strokeWidth={2.4}
                                  className={seenToneClass}
                                />
                                <CheckIcon
                                  size={14}
                                  strokeWidth={2.4}
                                  className={`${seenToneClass} absolute left-[6px]`}
                                />
                              </span>
                              {seenSummary ? <span>{seenSummary}</span> : null}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
              {typingUsers.length ? (
                <div className="text-xs text-secondary-400">
                  {typingUsers
                    .map((user) => user.first_name || user.name || "")
                    .filter(Boolean)
                    .join(", ")}{" "}
                  {t("is typing...")}
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 rounded-full border border-[#EADAF1] bg-white px-3 py-2"
      >
        <input
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            scheduleTyping(event.target.value);
          }}
          placeholder={t("Type a message")}
          className="w-full bg-transparent px-2 py-2 text-base text-secondary-600 outline-none"
        />
        <button
          type="submit"
          disabled={sendState === "sending" || content.trim().length === 0}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-primary-500 via-[#822485] to-secondary-500 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={t("Submit")}
        >
          {sendState === "sending" ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
          ) : (
            <PaperAirplaneIcon size={18} className="text-white" />
          )}
        </button>
      </form>
      {sendError ? (
        <p className="text-xs text-danger-600">{sendError}</p>
      ) : null}
      <Modal
        open={isSeenModalOpen}
        title={t("Seen by")}
        onClose={() => setSeenModalOpen(false)}
      >
        {seenByUsers.length ? (
          <div className="space-y-4">
            {seenByUsers.map((user) => (
              <div
                key={`seen-by-${user.id}`}
                className="flex items-center gap-3"
              >
                <UserAvatar user={user} size={42} withBorder />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-primary-900">
                    {user.name ||
                      `${user.first_name || ""} ${user.last_name || ""}`}
                  </p>
                  {user.last_read_at ? (
                    <p className="text-xs text-secondary-400">
                      {formatTime(user.last_read_at, dateLocale)}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-secondary-400">
            {t("No one has read this message yet.")}
          </p>
        )}
      </Modal>
    </div>
  );
}
