"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import Modal from "../../../../../components/ui/modal";
import UserAvatar from "../../../../../components/user/user-avatar";
import { ArrowLeftIcon, CheckIcon, PaperAirplaneIcon } from "../../../../../components/ui/heroicons";
import { useI18n } from "../../../../../components/i18n-provider";
import { apiRequest } from "../../../../lib/api-client";
import { getEcho } from "../../../../lib/realtime-client";
import { getUser } from "../../../../lib/session";

const reactionOptions = ["❤️", "😂", "👍", "😮", "😢", "👏"];

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

const formatFullDate = (value, locale) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;
  if (day && month && year) {
    return `${day}-${month}-${year}`;
  }
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
};

const formatDateTime = (value, locale) => {
  const day = formatFullDate(value, locale);
  const time = formatTime(value, locale);
  if (day && time) return `${day}, ${time}`;
  return day || time;
};

const buildDayKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "string") {
    return value.split("T")[0].split(" ")[0];
  }
  return "";
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
  const [isActionModalOpen, setActionModalOpen] = useState(false);
  const [isInfoModalOpen, setInfoModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const currentUser = getUser();
  const currentUserId =
    currentUser?.id !== null && currentUser?.id !== undefined
      ? Number(currentUser.id)
      : null;
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const messageRefs = useRef(new Map());
  const firstScrollRef = useRef(true);
  const messagesRef = useRef([]);
  const longPressTimeoutRef = useRef(null);
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

  const normalizeUser = (user) => {
    if (!user) return null;
    return {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      name: user.name,
      avatar_image_url: user.avatar_image_url,
      uses_default_image: user.uses_default_image
    };
  };

  const normalizeReplyTo = (replyTo) => {
    if (!replyTo) return null;
    return {
      id: replyTo.id,
      content: replyTo.content,
      type: replyTo.type,
      user: normalizeUser(replyTo.user)
    };
  };

  const normalizeMessage = (message) => {
    if (!message) return null;
    return {
      id: message.id,
      content: message.content,
      type: message.type,
      automatic: Boolean(message.automatic),
      created_at: message.created_at,
      user: normalizeUser(message.user),
      reply_to: normalizeReplyTo(message.reply_to),
      reactions: Array.isArray(message.reactions) ? message.reactions : [],
      my_reaction: message.my_reaction || null
    };
  };

  const normalizeMessages = (items) => {
    if (!items?.length) return [];
    return items.map(normalizeMessage).filter(Boolean);
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
      const remoteMessages = normalizeMessages(payload?.data || []);
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
      const remoteMessages = normalizeMessages(payload?.data || []);
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

    channel.listen(".message:reaction", (event) => {
      if (Number(event?.conversation_id) !== Number(params.id)) return;
      const messageId = event?.message_id;
      if (!messageId) return;
      const reactions = Array.isArray(event?.reactions)
        ? event.reactions
        : [];
      setMessages((prev) =>
        prev.map((message) => {
          if (Number(message.id) !== Number(messageId)) return message;
          return { ...message, reactions };
        })
      );
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

  const otherReaders = useMemo(() => {
    if (!readStates.length) return [];
    return readStates.filter((user) => Number(user.id) !== currentUserId);
  }, [readStates, currentUserId]);

  const getSeenUsersForMessage = (messageId) => {
    const messageNumber = Number(messageId);
    if (!Number.isFinite(messageNumber)) return [];
    if (!otherReaders.length) return [];
    return otherReaders
      .filter((user) => Number(user.last_read_message_id || 0) >= messageNumber)
      .sort((a, b) => {
        const aTime = a.last_read_at ? new Date(a.last_read_at).getTime() : 0;
        const bTime = b.last_read_at ? new Date(b.last_read_at).getTime() : 0;
        return bTime - aTime;
      });
  };

  const getSeenToneClass = (messageId) => {
    if (!otherReaders.length) return "text-secondary-300";
    const seenUsers = getSeenUsersForMessage(messageId);
    return seenUsers.length === otherReaders.length
      ? "text-secondary-600"
      : "text-secondary-300";
  };

  const selectedSeenUsers = useMemo(() => {
    if (!selectedMessage?.id) return [];
    return getSeenUsersForMessage(selectedMessage.id);
  }, [selectedMessage, otherReaders]);

  const typingLabel = useMemo(() => {
    if (!typingUsers.length) return "";
    const names = typingUsers
      .map((user) => user.first_name || user.name || "")
      .filter(Boolean)
      .join(", ");
    if (!names) return "";
    return `${names} ${t("is typing...")}`;
  }, [typingUsers, t]);

  const selectedIsMine = useMemo(() => {
    if (!selectedMessage?.user?.id || currentUserId === null) return false;
    return Number(selectedMessage.user.id) === currentUserId;
  }, [selectedMessage, currentUserId]);

  const formatReadStamp = (value) => {
    return formatDateTime(value, dateLocale);
  };

  const getUserDisplayName = (user) => {
    if (!user) return "";
    return (
      user.name ||
      `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
      user.first_name ||
      ""
    );
  };

  const getReplySnippet = (content) => {
    if (!content) return "";
    const trimmed = content.trim();
    if (trimmed.length <= 80) return trimmed;
    return `${trimmed.slice(0, 80)}...`;
  };

  const setMessageRef = (messageId) => (node) => {
    if (!messageId) return;
    if (node) {
      messageRefs.current.set(messageId, node);
    } else {
      messageRefs.current.delete(messageId);
    }
  };

  const scrollToMessage = (messageId) => {
    const node = messageRefs.current.get(messageId);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);
  };

  useEffect(() => {
    if (!highlightedMessageId) return undefined;
    const timeout = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [highlightedMessageId]);

  useEffect(() => {
    if (!bottomRef.current) return;
    const behavior = firstScrollRef.current ? "auto" : "smooth";
    bottomRef.current.scrollIntoView({ behavior, block: "end" });
    firstScrollRef.current = false;
  }, [sortedMessages.length]);

  const sendTyping = async (isTyping) => {
    if (!currentUserId) return;
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

  const openMessageActions = (message) => {
    if (!message) return;
    setSelectedMessage(message);
    setActionModalOpen(true);
  };

  const startLongPress = (message) => {
    if (!message || message.isTemp) return;
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }
    longPressTimeoutRef.current = setTimeout(() => {
      longPressTimeoutRef.current = null;
      openMessageActions(message);
    }, 450);
  };

  const cancelLongPress = () => {
    if (!longPressTimeoutRef.current) return;
    clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  const copySelectedMessage = async () => {
    if (!selectedMessage?.content) return;
    const contentToCopy = selectedMessage.content;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(contentToCopy);
        return;
      }
      throw new Error("Clipboard API unavailable");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = contentToCopy;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  const closeActionModal = () => {
    setActionModalOpen(false);
    setSelectedMessage(null);
  };

  const closeInfoModal = () => {
    setInfoModalOpen(false);
    setSelectedMessage(null);
  };

  const openInfoModal = () => {
    setActionModalOpen(false);
    setInfoModalOpen(true);
  };

  const updateMessageReactions = (messageId, reactions, myReaction) => {
    if (!messageId) return;
    setMessages((prev) =>
      prev.map((message) => {
        if (Number(message.id) !== Number(messageId)) return message;
        return {
          ...message,
          reactions: Array.isArray(reactions)
            ? reactions
            : message.reactions || [],
          my_reaction:
            myReaction !== undefined ? myReaction : message.my_reaction || null
        };
      })
    );
  };

  const sendReaction = async (messageId, emoji) => {
    if (!messageId || !emoji) return;
    try {
      const payload = await apiRequest(
        `conversations/${params.id}/messages/${messageId}/reactions`,
        {
          method: "POST",
          body: { emoji }
        }
      );
      const data = payload?.data || {};
      updateMessageReactions(
        messageId,
        data.reactions,
        data.my_reaction ?? null
      );
    } catch {
      // Ignore reaction errors.
    }
  };

  const startReply = () => {
    if (!selectedMessage) return;
    setReplyToMessage(selectedMessage);
    setActionModalOpen(false);
    setSelectedMessage(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sendState !== "idle") return;
    setSendState("sending");
    setSendError("");
    const tempId = `temp-${Date.now()}`;
    const replyPayload = replyToMessage
      ? {
          id: replyToMessage.id,
          content: replyToMessage.content,
          type: replyToMessage.type,
          user: replyToMessage.user
            ? {
                id: replyToMessage.user.id,
                first_name: replyToMessage.user.first_name,
                last_name: replyToMessage.user.last_name,
                name: replyToMessage.user.name
              }
            : null
        }
      : null;
    const optimisticMessage = {
      id: tempId,
      content: trimmed,
      created_at: new Date().toISOString(),
      automatic: false,
      isTemp: true,
      reply_to: replyPayload,
      reactions: [],
      my_reaction: null,
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
          body: {
            content: trimmed,
            reply_to_message_id: replyPayload?.id || null
          }
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
      setReplyToMessage(null);
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
                  const dateKey = buildDayKey(message?.created_at);
                  const showDate = dateKey && dateKey !== lastDate;
                  if (showDate) {
                    lastDate = dateKey;
                  }
                  const isMine = Number(message?.user?.id) === currentUserId;
                  const isTemp = Boolean(message?.isTemp);
                  const allowActions = !isTemp;
                  const reactions = Array.isArray(message?.reactions)
                    ? message.reactions
                    : [];
                  const isHighlighted =
                    Number(message?.id) === Number(highlightedMessageId);
                  if (message?.automatic) {
                    return (
                      <div
                        key={message.id}
                        ref={setMessageRef(message.id)}
                        className="space-y-2"
                      >
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
                    <div
                      key={message.id}
                      ref={setMessageRef(message.id)}
                      className="space-y-2"
                    >
                      {showDate ? (
                        <div className="flex justify-center">
                            <span className="rounded-full bg-[#F7F1FA] px-3 py-1 text-xs text-secondary-500">
                              {formatDay(message.created_at, dateLocale)}
                            </span>
                          </div>
                        ) : null}
                      <div
                        className={`flex items-end ${
                          isMine ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`flex max-w-[75%] flex-col ${
                            isMine ? "items-end" : "items-start"
                          }`}
                        >
                          {!isMine ? (
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                user={message.user}
                                size={26}
                                withBorder
                              />
                              <p className="text-xs font-semibold text-primary-900">
                                {getUserDisplayName(message.user)}
                              </p>
                            </div>
                          ) : null}
                          <div
                            className={`w-full rounded-2xl px-4 py-3 text-sm shadow-sm ${
                              isMine
                                ? "bg-[#EADAF1] text-primary-900 rounded-br-sm"
                                : "bg-[#F4F4F5] text-secondary-700 rounded-bl-sm"
                            } ${isTemp ? "opacity-70" : ""} ${
                              isHighlighted ? "ring-2 ring-secondary-300" : ""
                            } relative`}
                            onMouseDown={
                              allowActions
                                ? () => startLongPress(message)
                              : undefined
                            }
                            onMouseUp={allowActions ? cancelLongPress : undefined}
                            onMouseLeave={allowActions ? cancelLongPress : undefined}
                            onTouchStart={
                              allowActions
                                ? () => startLongPress(message)
                                : undefined
                            }
                            onTouchEnd={allowActions ? cancelLongPress : undefined}
                            onTouchCancel={allowActions ? cancelLongPress : undefined}
                            onContextMenu={
                              allowActions
                              ? (event) => {
                                  event.preventDefault();
                                  openMessageActions(message);
                                }
                              : undefined
                            }
                          >
                            {!isMine ? (
                              <span className="pointer-events-none absolute left-0 top-4 h-3 w-3 -translate-x-1.5 rotate-45 bg-[#F4F4F5]" />
                            ) : null}
                            {message.reply_to ? (
                              <div
                                className={`rounded-xl border-l-2 px-3 py-2 text-xs ${
                                  isMine
                                    ? "border-secondary-500 bg-white/60 text-secondary-700"
                                    : "border-secondary-400 bg-white/80 text-secondary-600"
                                } cursor-pointer`}
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                  scrollToMessage(message.reply_to.id)
                                }
                              >
                                <p className="font-semibold">
                                  {getUserDisplayName(message.reply_to.user)}
                                </p>
                                <p className="mt-1 text-secondary-500">
                                  {getReplySnippet(message.reply_to.content)}
                                </p>
                              </div>
                            ) : null}
                            <p className="mt-1 text-sm leading-relaxed">
                              {message.content}
                            </p>
                            <p className="mt-2 text-[11px] text-secondary-400">
                              {isTemp
                                ? t("Loading more...")
                                : formatTime(message.created_at, dateLocale)}
                            </p>
                            {isMine && !isTemp ? (
                            <div className="mt-2 flex justify-end">
                              <span
                                className={`relative inline-flex h-3 w-5 items-center justify-center ${getSeenToneClass(message.id)}`}
                              >
                                  <CheckIcon
                                    size={14}
                                    strokeWidth={2.4}
                                    className={getSeenToneClass(message.id)}
                                  />
                                  <CheckIcon
                                    size={14}
                                    strokeWidth={2.4}
                                    className={`${getSeenToneClass(message.id)} absolute left-[6px]`}
                                  />
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      {reactions.length ? (
                        <div
                          className={`flex flex-wrap gap-1 ${
                            isMine ? "justify-end" : "justify-start"
                          }`}
                        >
                          {reactions.map((reaction) => {
                            const isMineReaction =
                              message.my_reaction === reaction.emoji;
                            return (
                              <button
                                key={`${message.id}-${reaction.emoji}`}
                                type="button"
                                onClick={() =>
                                  sendReaction(message.id, reaction.emoji)
                                }
                                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                                  isMineReaction
                                    ? "border-secondary-500 bg-[#F7F1FA] text-secondary-700"
                                    : "border-[#EADAF1] bg-white text-secondary-500"
                                }`}
                              >
                                <span>{reaction.emoji}</span>
                                <span>{reaction.count}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                });
              })()}
              <div ref={bottomRef} />
            </div>
          ) : null}
          {typingLabel ? (
            <div className="sticky bottom-0 z-10 bg-white/80 px-1 py-1 text-xs text-secondary-400">
              {typingLabel}
            </div>
          ) : null}
        </div>
      </div>

      {replyToMessage ? (
        <div className="flex items-center justify-between rounded-2xl border border-[#EADAF1] bg-[#F7F1FA] px-3 py-2 text-xs text-secondary-600">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-secondary-700">
              {t("Replying to")} {getUserDisplayName(replyToMessage.user)}
            </p>
            <p className="mt-1 truncate text-secondary-500">
              {getReplySnippet(replyToMessage.content)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyToMessage(null)}
            className="ml-3 text-sm font-semibold text-secondary-500"
            aria-label={t("Close")}
          >
            x
          </button>
        </div>
      ) : null}

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 rounded-full border border-[#EADAF1] bg-white px-3 py-2"
      >
        <input
          ref={inputRef}
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
        open={isActionModalOpen}
        title={t("Message options")}
        onClose={closeActionModal}
      >
        {selectedMessage ? (
          <div className="space-y-3">
            <div className="flex flex-wrap justify-center gap-2">
              {reactionOptions.map((emoji) => (
                <button
                  key={`reaction-${emoji}`}
                  type="button"
                  onClick={() => {
                    sendReaction(selectedMessage.id, emoji);
                    closeActionModal();
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[#EADAF1] text-lg transition hover:bg-[#F7F1FA]"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={startReply}
              className="w-full rounded-2xl border border-[#EADAF1] px-4 py-3 text-sm font-semibold text-primary-900 transition hover:bg-[#F7F1FA]"
            >
              {t("Reply")}
            </button>
            {selectedMessage.content ? (
              <button
                type="button"
                onClick={async () => {
                  await copySelectedMessage();
                  closeActionModal();
                }}
                className="w-full rounded-2xl border border-[#EADAF1] px-4 py-3 text-sm font-semibold text-primary-900 transition hover:bg-[#F7F1FA]"
              >
                {t("Copy message")}
              </button>
            ) : null}
            {selectedIsMine ? (
              <button
                type="button"
                onClick={openInfoModal}
                className="w-full rounded-2xl border border-[#EADAF1] px-4 py-3 text-sm font-semibold text-primary-900 transition hover:bg-[#F7F1FA]"
              >
                {t("Message info")}
              </button>
            ) : null}
          </div>
        ) : null}
      </Modal>
      <Modal
        open={isInfoModalOpen}
        title={locale === "fr" ? "Lu par" : t("Seen by")}
        onClose={closeInfoModal}
      >
        {selectedSeenUsers.length ? (
          <div className="space-y-4">
            {selectedSeenUsers.map((user) => (
              <div
                key={`seen-by-${user.id}`}
                className="flex items-center gap-3"
              >
                <UserAvatar user={user} size={42} withBorder />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-primary-900">
                      {user.name ||
                        `${user.first_name || ""} ${
                          user.last_name || ""
                        }`.trim()}
                    </p>
                    {offerOwnerId && Number(user.id) === Number(offerOwnerId) ? (
                      <span className="rounded-full bg-[#F7F1FA] px-2 py-0.5 text-[10px] font-semibold text-secondary-600">
                        {t("Organizer")}
                      </span>
                    ) : null}
                  </div>
                  {user.last_read_at ? (
                    <p className="text-xs text-secondary-400">
                      {formatReadStamp(user.last_read_at)}
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
