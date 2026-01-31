"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import Modal from "../../../../../components/ui/modal";
import UserAvatar from "../../../../../components/user/user-avatar";
import {
  ArrowLeftIcon,
  CheckIcon,
  MapPinIcon,
  PaperAirplaneIcon
} from "../../../../../components/ui/heroicons";
import { useI18n } from "../../../../../components/i18n-provider";
import { apiRequest } from "../../../../lib/api-client";
import { getEcho } from "../../../../lib/realtime-client";
import { getUser } from "../../../../lib/session";

const reactionOptions = ["❤️", "😂", "👍", "😮", "😢", "👏"];
const nameColorClasses = [
  "text-[#1D4ED8]",
  "text-[#0F766E]",
  "text-[#B45309]",
  "text-[#B91C1C]",
  "text-[#15803D]",
  "text-[#0E7490]"
];


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

const AttachmentIcon = ({ size = 18, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M21.44 11.05l-7.78 7.78a5 5 0 01-7.07-7.07l8.49-8.49a3.5 3.5 0 014.95 4.95l-8.13 8.13a2 2 0 01-2.83-2.83l7.42-7.42" />
  </svg>
);

const PollIcon = ({ size = 18, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M4 20V10" />
    <path d="M10 20V4" />
    <path d="M16 20v-6" />
    <path d="M22 20H2" />
  </svg>
);

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
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    hasMore: false
  });
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isPollModalOpen, setPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [pollAllowChange, setPollAllowChange] = useState(true);
  const [pollState, setPollState] = useState("idle");
  const [pollError, setPollError] = useState("");
  const [pendingPollSelections, setPendingPollSelections] = useState({});
  const [isAttachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [pinnedJumpState, setPinnedJumpState] = useState("idle");
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
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const attachmentMenuRef = useRef(null);
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
  const pendingScrollRestoreRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const pinnedMessageRef = useRef(null);
  const paginationRef = useRef({
    currentPage: 1,
    lastPage: 1,
    hasMore: false
  });
  const loadingMoreRef = useRef(false);
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

  useEffect(() => {
    pinnedMessageRef.current = pinnedMessage;
  }, [pinnedMessage]);

  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  useEffect(() => {
    if (!isAttachmentMenuOpen) return undefined;
    const handleClick = (event) => {
      if (!attachmentMenuRef.current) return;
      if (attachmentMenuRef.current.contains(event.target)) return;
      setAttachmentMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isAttachmentMenuOpen]);

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

  const normalizePoll = (poll) => {
    if (!poll) return null;
    return {
      id: poll.id,
      allow_multiple: Boolean(poll.allow_multiple),
      allow_change: Boolean(poll.allow_change),
      closed_at: poll.closed_at || null,
      is_closed: Boolean(poll.is_closed || poll.closed_at),
      options: Array.isArray(poll.options)
        ? poll.options.map((option) => ({
            id: option.id,
            label: option.label,
            votes_count: Number(option.votes_count || 0)
          }))
        : [],
      my_votes: Array.isArray(poll.my_votes)
        ? poll.my_votes.map((vote) => Number(vote))
        : []
    };
  };

  const normalizeMessage = (message) => {
    if (!message) return null;
    return {
      id: message.id,
      content: message.content,
      type: message.type || "text",
      automatic: Boolean(message.automatic),
      created_at: message.created_at,
      user: normalizeUser(message.user),
      reply_to: normalizeReplyTo(message.reply_to),
      reactions: Array.isArray(message.reactions) ? message.reactions : [],
      my_reaction: message.my_reaction || null,
      poll: normalizePoll(message.poll)
    };
  };

  const normalizeMessages = (items) => {
    if (!items?.length) return [];
    return items.map(normalizeMessage).filter(Boolean);
  };

  const mergeMessagesById = (current, incoming) => {
    const merged = new Map();
    current.forEach((message) => {
      if (message?.id !== undefined) {
        merged.set(String(message.id), message);
      }
    });
    incoming.forEach((message) => {
      if (message?.id !== undefined) {
        merged.set(String(message.id), message);
      }
    });
    return Array.from(merged.values());
  };

  const getPaginationFromPayload = (payload) => {
    const meta = payload?.meta?.pagination || {};
    const currentPage = Number(meta.current_page || 1);
    const lastPage = Number(meta.last_page || currentPage);
    const hasMore =
      typeof meta.has_more === "boolean"
        ? meta.has_more
        : currentPage < lastPage;
    return {
      currentPage,
      lastPage,
      hasMore
    };
  };

  const applyPagination = (payload, nextPage = null) => {
    const nextMeta = getPaginationFromPayload(payload);
    setPagination((prev) => {
      const currentPage =
        typeof nextPage === "number" ? nextPage : prev?.currentPage || 1;
      const lastPage =
        Number(nextMeta.lastPage || prev?.lastPage || currentPage);
      return {
        currentPage,
        lastPage,
        hasMore: currentPage < lastPage
      };
    });
  };

  const normalizePinnedMessage = (payload) => {
    const pinned = payload?.meta?.pinned_message;
    return normalizeMessage(pinned);
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
    setError("");
    setIsLoadingOlder(false);
    setPendingPollSelections({});
    firstScrollRef.current = true;
    pendingScrollRestoreRef.current = null;
    try {
      const payload = await apiRequest(
        `conversations/${params.id}/messages?lite=1&page=1`,
        { cache: false }
      );
      const remoteMessages = normalizeMessages(payload?.data || []);
      const conversationData = payload?.meta?.conversation || null;
      const remoteReadStates = payload?.meta?.read_states || [];
      const pinned = normalizePinnedMessage(payload);
      lastRemoteSignatureRef.current = buildMessageSignature(remoteMessages);
      lastConversationStampRef.current =
        conversationData?.last_message_at || "";
      setMessages(remoteMessages);
      setConversation(conversationData);
      setReadStates(remoteReadStates);
      setPinnedMessage(pinned);
      applyPagination(payload, 1);
      setStatus("ready");
    } catch (err) {
      setError(err?.message || t("general.error_has_occurred"));
      setStatus("error");
    }
  };

  const refreshMessages = async () => {
    try {
      const payload = await apiRequest(
        `conversations/${params.id}/messages?lite=1&page=1`,
        { cache: false }
      );
      const remoteMessages = normalizeMessages(payload?.data || []);
      const conversationData = payload?.meta?.conversation || null;
      const remoteReadStates = payload?.meta?.read_states || [];
      const remoteSignature = buildMessageSignature(remoteMessages);
      const conversationStamp = conversationData?.last_message_at || "";
      const pinned = normalizePinnedMessage(payload);
      const hasTempMessages = messagesRef.current.some(
        (message) => message?.isTemp
      );

      applyPagination(payload, paginationRef.current?.currentPage || 1);

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
        setPinnedMessage(pinned);
        setStatus((prev) => (prev === "error" ? "ready" : prev));
        return;
      }

      setConversation(conversationData);
      setMessages((prev) => {
        const tempMessages = prev.filter((message) => message?.isTemp);
        const nonTempMessages = prev.filter((message) => !message?.isTemp);
        let mergedMessages = mergeMessagesById(
          nonTempMessages,
          remoteMessages
        );

        if (tempMessages.length) {
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
          mergedMessages = mergeMessagesById(mergedMessages, filteredTemps);
        }

        return mergedMessages;
      });
      setReadStates(remoteReadStates);
      setPinnedMessage(pinned);
      lastRemoteSignatureRef.current = remoteSignature;
      lastConversationStampRef.current = conversationStamp;
      setError("");
      setStatus((prev) => (prev === "error" ? "ready" : prev));
    } catch {
      // Silent refresh; keep current UI state.
    }
  };

  const loadOlderMessages = async () => {
    if (loadingMoreRef.current || !paginationRef.current?.hasMore) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    const nextPage = (paginationRef.current?.currentPage || 1) + 1;
    pendingScrollRestoreRef.current = {
      scrollHeight: container.scrollHeight,
      scrollTop: container.scrollTop
    };
    loadingMoreRef.current = true;
    setIsLoadingOlder(true);
    let didAppend = false;
    try {
      const payload = await apiRequest(
        `conversations/${params.id}/messages?lite=1&page=${nextPage}`,
        { cache: false }
      );
      const olderMessages = normalizeMessages(payload?.data || []);
      if (olderMessages.length) {
        const existingIds = new Set(
          messagesRef.current.map((message) => String(message?.id))
        );
        didAppend = olderMessages.some(
          (message) => !existingIds.has(String(message?.id))
        );
      }
      setMessages((prev) => mergeMessagesById(prev, olderMessages));
      applyPagination(payload, nextPage);
    } catch {
      // Ignore load older errors; keep current UI.
      pendingScrollRestoreRef.current = null;
    } finally {
      if (!didAppend) {
        pendingScrollRestoreRef.current = null;
      }
      loadingMoreRef.current = false;
      setIsLoadingOlder(false);
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (status !== "ready") return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      160;
    stickToBottomRef.current = nearBottom;
    if (container.scrollTop < 120) {
      loadOlderMessages();
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

    channel.listen(".message:poll", (event) => {
      if (Number(event?.conversation_id) !== Number(params.id)) return;
      const messageId = event?.message_id;
      if (!messageId || !event?.poll) return;
      updateMessagePoll(messageId, event.poll, { preservePending: true });
    });

    channel.listen(".message:pin", (event) => {
      if (Number(event?.conversation_id) !== Number(params.id)) return;
      if (event?.action === "pinned") {
        const pinnedPayload = event?.pinned_message || null;
        const cachedPinned = messagesRef.current.find(
          (message) => Number(message?.id) === Number(event?.message_id)
        );
        if (cachedPinned) {
          setPinnedMessage(cachedPinned);
          return;
        }
        const normalizedPinned = pinnedPayload
          ? normalizeMessage(pinnedPayload)
          : null;
        setPinnedMessage(normalizedPinned || pinnedPayload || null);
        return;
      }
      if (event?.action === "unpinned") {
        setPinnedMessage(null);
      }
    });

    channel.listen(".message:deleted", (event) => {
      if (Number(event?.conversation_id) !== Number(params.id)) return;
      const messageId = event?.message_id;
      if (!messageId) return;
      setMessages((prev) =>
        prev.filter((message) => Number(message.id) !== Number(messageId))
      );
      setPinnedMessage((prev) =>
        prev && Number(prev.id) === Number(messageId) ? null : prev
      );
    });

    return () => {
      echo.leave(`private-${channelName}`);
    };
  }, [currentUserId, params.id]);

  const offer = conversation?.offer;
  const offerOwnerId = offer?.owner?.id || offer?.owner_id;
  const isOfferOwner =
    offerOwnerId !== null &&
    offerOwnerId !== undefined &&
    Number(offerOwnerId) === currentUserId;
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

  const selectedIsPinned = useMemo(() => {
    if (!selectedMessage?.id || !pinnedMessage?.id) return false;
    return Number(selectedMessage.id) === Number(pinnedMessage.id);
  }, [selectedMessage, pinnedMessage]);

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

  const getPinnedPreview = (message) => {
    if (!message) return "";
    if (message.type === "poll") {
      return message.content || t("poll.label");
    }
    return message.content || "";
  };

  const hasSameIds = (a = [], b = []) => {
    if (a.length !== b.length) return false;
    const setA = new Set(a);
    return b.every((id) => setA.has(id));
  };

  const getNameColorClass = (userId) => {
    const palette = nameColorClasses;
    if (!palette.length) return "text-secondary-600";
    const idValue = userId ?? "";
    const raw = String(idValue);
    let hash = 0;
    for (let index = 0; index < raw.length; index += 1) {
      hash = (hash * 31 + raw.charCodeAt(index)) % palette.length;
    }
    return palette[hash] || "text-secondary-600";
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

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (pendingScrollRestoreRef.current) {
      const { scrollHeight, scrollTop } = pendingScrollRestoreRef.current;
      const nextScrollHeight = container.scrollHeight;
      container.scrollTop = nextScrollHeight - scrollHeight + scrollTop;
      pendingScrollRestoreRef.current = null;
      return;
    }
    if (firstScrollRef.current) {
      container.scrollTop = container.scrollHeight;
      firstScrollRef.current = false;
      return;
    }
    if (stickToBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
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
    }, 700);
  };

  const loadPinnedMessage = async (messageId) => {
    if (!messageId || loadingMoreRef.current) return false;
    if (messageRefs.current.get(messageId)) {
      scrollToMessage(messageId);
      return true;
    }
    if (!paginationRef.current?.hasMore) return false;

    loadingMoreRef.current = true;
    setPinnedJumpState("loading");
    try {
      let nextPage = paginationRef.current?.currentPage || 1;
      while (paginationRef.current?.hasMore) {
        nextPage += 1;
        const payload = await apiRequest(
          `conversations/${params.id}/messages?lite=1&page=${nextPage}`,
          { cache: false }
        );
        const olderMessages = normalizeMessages(payload?.data || []);
        setMessages((prev) => mergeMessagesById(prev, olderMessages));
        applyPagination(payload, nextPage);
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (
          olderMessages.some(
            (message) => Number(message.id) === Number(messageId)
          )
        ) {
          scrollToMessage(messageId);
          return true;
        }
        if (!paginationRef.current?.hasMore) break;
      }
    } catch {
      // Ignore jump errors.
    } finally {
      loadingMoreRef.current = false;
      setPinnedJumpState("idle");
    }
    return false;
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

  const updateMessagePoll = (messageId, poll, options = {}) => {
    if (!messageId || !poll) return;
    const { preservePending = false } = options;
    const existingMessage = messagesRef.current.find(
      (message) => Number(message?.id) === Number(messageId)
    );
    const existingVotes =
      existingMessage?.poll?.my_votes ||
      (pinnedMessageRef.current &&
      Number(pinnedMessageRef.current.id) === Number(messageId)
        ? pinnedMessageRef.current.poll?.my_votes
        : null);
    const pollWithVotes = Array.isArray(poll.my_votes)
      ? poll
      : {
          ...poll,
          my_votes: Array.isArray(existingVotes) ? existingVotes : []
        };
    const normalizedPoll = normalizePoll(pollWithVotes);
    if (!normalizedPoll) return;
    if (!preservePending) {
      setPendingPollSelections((prev) => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
    }
    setMessages((prev) =>
      prev.map((message) => {
        if (Number(message.id) !== Number(messageId)) return message;
        return { ...message, poll: normalizedPoll };
      })
    );
    setPinnedMessage((prev) => {
      if (!prev || Number(prev.id) !== Number(messageId)) return prev;
      return { ...prev, poll: normalizedPoll };
    });
  };

  const handlePollVote = async (message, optionId) => {
    const normalizedOptionId = Number(optionId);
    if (!message?.poll || !normalizedOptionId) return;
    if (message.poll.is_closed) return;
    const canEditSelection =
      message.poll.allow_change || (message.poll.my_votes || []).length === 0;
    if (!canEditSelection) return;

    if (message.poll.allow_multiple) {
      setPendingPollSelections((prev) => {
        const current =
          prev[message.id] ?? message.poll.my_votes ?? [];
        const nextVotes = new Set(current);
        if (nextVotes.has(normalizedOptionId)) {
          nextVotes.delete(normalizedOptionId);
        } else {
          nextVotes.add(normalizedOptionId);
        }
        return { ...prev, [message.id]: Array.from(nextVotes) };
      });
      return;
    }

    try {
      const payload = await apiRequest(
        `conversations/${params.id}/messages/${message.id}/poll-votes`,
        {
          method: "POST",
          body: { option_ids: [normalizedOptionId] }
        }
      );
      const updatedPoll = payload?.data?.poll;
      if (updatedPoll) {
        updateMessagePoll(message.id, updatedPoll);
      }
    } catch {
      // Ignore poll vote errors.
    }
  };

  const submitPollSelection = async (message) => {
    if (!message?.poll || !message.poll.allow_multiple) return;
    if (message.poll.is_closed) return;
    const selection = (pendingPollSelections[message.id] || [])
      .map((id) => Number(id))
      .filter(Boolean);
    if (!selection.length) return;
    try {
      const payload = await apiRequest(
        `conversations/${params.id}/messages/${message.id}/poll-votes`,
        {
          method: "POST",
          body: { option_ids: selection }
        }
      );
      const updatedPoll = payload?.data?.poll;
      if (updatedPoll) {
        updateMessagePoll(message.id, updatedPoll);
      }
    } catch {
      // Ignore poll vote errors.
    }
  };

  const handleClosePoll = async (message) => {
    if (!message?.id) return;
    try {
      const payload = await apiRequest(
        `conversations/${params.id}/messages/${message.id}/poll-close`,
        { method: "POST" }
      );
      const updatedPoll = payload?.data?.poll;
      if (updatedPoll) {
        updateMessagePoll(message.id, updatedPoll);
      }
    } catch {
      // Ignore poll close errors.
    }
  };

  const handlePinMessage = async (message) => {
    if (!message?.id) return;
    try {
      await apiRequest(
        `conversations/${params.id}/messages/${message.id}/pin`,
        { method: "POST" }
      );
      setPinnedMessage(message);
    } catch {
      // Ignore pin errors.
    }
  };

  const handleUnpinMessage = async (message) => {
    if (!message?.id) return;
    try {
      await apiRequest(
        `conversations/${params.id}/messages/${message.id}/pin`,
        { method: "DELETE" }
      );
      setPinnedMessage(null);
    } catch {
      // Ignore unpin errors.
    }
  };

  const resetPollForm = () => {
    setPollQuestion("");
    setPollOptions(["", ""]);
    setPollAllowMultiple(false);
    setPollAllowChange(true);
    setPollError("");
  };

  const openPollModal = () => {
    resetPollForm();
    setAttachmentMenuOpen(false);
    setPollModalOpen(true);
  };

  const closePollModal = () => {
    setPollModalOpen(false);
    setPollError("");
  };

  const updatePollOption = (index, value) => {
    setPollOptions((prev) =>
      prev.map((option, optionIndex) =>
        optionIndex === index ? value : option
      )
    );
  };

  const addPollOption = () => {
    setPollOptions((prev) => {
      if (prev.length >= 10) return prev;
      return [...prev, ""];
    });
  };

  const removePollOption = (index) => {
    setPollOptions((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, optionIndex) => optionIndex !== index);
    });
  };

  const handleCreatePoll = async () => {
    const trimmedQuestion = pollQuestion.trim();
    const cleanedOptions = pollOptions
      .map((option) => option.trim())
      .filter(Boolean);

    if (!trimmedQuestion) {
      setPollError(t("poll.question_required"));
      return;
    }
    if (cleanedOptions.length < 2) {
      setPollError(t("poll.options_required"));
      return;
    }

    setPollState("sending");
    setPollError("");
    try {
      const response = await apiRequest(
        `conversations/${params.id}/messages?lite=1`,
        {
          method: "POST",
          body: {
            content: trimmedQuestion,
            type: "poll",
            poll: {
              options: cleanedOptions,
              allow_multiple: pollAllowMultiple,
              allow_change: pollAllowChange
            }
          }
        }
      );
      const newMessage = normalizeMessage(response?.data || null);
      if (newMessage) {
        setMessages((prev) => mergeMessagesById(prev, [newMessage]));
        stickToBottomRef.current = true;
      }
      closePollModal();
    } catch (err) {
      setPollError(err?.message || t("general.error_has_occurred"));
    } finally {
      setPollState("idle");
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
    setAttachmentMenuOpen(false);
    stickToBottomRef.current = true;
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
      type: "text",
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
        {pinnedMessage ? (
          <div className="mb-2 flex items-center gap-3 rounded-2xl border border-[#EADAF1] bg-white px-3 py-2 text-xs text-secondary-500 shadow-sm">
            <button
              type="button"
              onClick={() => loadPinnedMessage(pinnedMessage.id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <MapPinIcon size={14} className="text-secondary-500" />
              <div className="min-w-0">
                <p className="truncate text-[11px] text-secondary-500">
                  {getPinnedPreview(pinnedMessage)}
                </p>
              </div>
            </button>
            {pinnedJumpState === "loading" ? (
              <span className="text-[11px] text-secondary-400">
                {t("chat.loading_older")}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto pr-2"
        >

          {isLoadingOlder ? (
            <div className="flex items-center justify-center py-2 text-xs text-secondary-400">
              {t("chat.loading_older")}
            </div>
          ) : null}
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
                  const poll = message?.type === "poll" ? message.poll : null;
                  const pollTotalVotes = poll?.options?.reduce(
                    (sum, option) => sum + (option?.votes_count || 0),
                    0
                  );
                  const pendingSelection = poll?.allow_multiple
                    ? pendingPollSelections[message.id]
                    : null;
                  const pollSelection =
                    poll?.allow_multiple && Array.isArray(pendingSelection)
                      ? pendingSelection
                      : poll?.my_votes || [];
                  const hasPendingSelection =
                    poll?.allow_multiple &&
                    Array.isArray(pendingSelection) &&
                    !hasSameIds(pendingSelection, poll?.my_votes || []);
                  const canEditSelection =
                    poll &&
                    !poll.is_closed &&
                    (poll.allow_change || (poll.my_votes || []).length === 0);
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
                              <p
                                className={`text-xs font-semibold ${getNameColorClass(message?.user?.id)}`}
                              >
                                {getUserDisplayName(message.user)}
                              </p>
                            </div>
                          ) : null}
                          <div
                            className={`w-full rounded-2xl px-4 py-3 text-sm shadow-sm ${
                              isMine
                                ? "bg-[#EADAF1] text-primary-900 rounded-br-sm"
                                : "bg-[#F4F4F5] text-secondary-700 rounded-tl-none"
                            } ${!isMine ? "mt-1" : ""} ${
                              isTemp ? "opacity-70" : ""
                            } ${!isMine ? "ml-3" : ""} ${
                              isHighlighted ? "ring-2 ring-secondary-300" : ""
                            } relative`}
                            style={{
                              WebkitUserSelect: "none",
                              userSelect: "none",
                              WebkitTouchCallout: "none"
                            }}
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
                            {poll ? (
                              <div className="mt-1 space-y-2">
                                <p className="text-sm font-semibold text-primary-900">
                                  {message.content}
                                </p>
                                <div className="space-y-2">
                                  {(poll.options || []).map((option) => {
                                    const isSelected = pollSelection.includes(
                                      option.id
                                    );
                                    const percent = pollTotalVotes
                                      ? Math.round(
                                          (option.votes_count /
                                            pollTotalVotes) *
                                            100
                                        )
                                      : 0;
                                    return (
                                      <button
                                        key={`poll-option-${message.id}-${option.id}`}
                                        type="button"
                                        disabled={!canEditSelection}
                                        onClick={() =>
                                          handlePollVote(message, option.id)
                                        }
                                        className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                                          isSelected
                                            ? "border-secondary-500 bg-[#F7F1FA] text-primary-900"
                                            : "border-[#EADAF1] bg-white text-secondary-700"
                                        } ${
                                          canEditSelection
                                            ? "hover:bg-[#F7F1FA]"
                                            : "cursor-default opacity-70"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="flex-1">
                                            {option.label}
                                          </span>
                                          <span className="text-[11px] text-secondary-500">
                                            {option.votes_count}
                                          </span>
                                        </div>
                                        <div className="mt-2 h-1 w-full rounded-full bg-[#EADAF1]">
                                          <div
                                            className="h-full rounded-full bg-secondary-500"
                                            style={{
                                              width: `${percent}%`
                                            }}
                                          />
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-secondary-400">
                                  <span>
                                    {t("poll.votes", {
                                      count: pollTotalVotes
                                    })}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {poll.allow_multiple ? (
                                      <span>{t("poll.multi_choice")}</span>
                                    ) : (
                                      <span>{t("poll.single_choice")}</span>
                                    )}
                                    {poll.is_closed ? (
                                      <span>{t("poll.closed")}</span>
                                    ) : null}
                                  </div>
                                </div>
                                {poll.allow_multiple && canEditSelection ? (
                                  <div className="flex justify-end">
                                    <button
                                      type="button"
                                      disabled={
                                        !hasPendingSelection ||
                                        pollSelection.length === 0
                                      }
                                      onClick={() =>
                                        submitPollSelection(message)
                                      }
                                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                                        hasPendingSelection &&
                                        pollSelection.length > 0
                                          ? "bg-secondary-500 text-white"
                                          : "bg-[#EADAF1] text-secondary-400"
                                      }`}
                                    >
                                      {t("poll.submit")}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <p className="mt-1 text-sm leading-relaxed">
                                {message.content}
                              </p>
                            )}
                            <div
                              className={`mt-2 flex items-center ${
                                isMine ? "justify-end gap-2" : "justify-start"
                              } text-[11px] text-secondary-400`}
                            >
                              <span>
                                {isTemp
                                  ? t("Loading more...")
                                  : formatTime(message.created_at, dateLocale)}
                              </span>
                              {isMine && !isTemp ? (
                                <span
                                  className={`relative inline-flex h-4 w-6 items-center justify-center ${getSeenToneClass(message.id)}`}
                                >
                                  <CheckIcon
                                    size={16}
                                    strokeWidth={2.4}
                                    className={getSeenToneClass(message.id)}
                                  />
                                  <CheckIcon
                                    size={16}
                                    strokeWidth={2.4}
                                    className={`${getSeenToneClass(message.id)} absolute left-[8px]`}
                                  />
                                </span>
                              ) : null}
                            </div>
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

      <div className="relative">
        {isOfferOwner && isAttachmentMenuOpen ? (
          <div
            ref={attachmentMenuRef}
            className="absolute bottom-full left-0 z-20 mb-3 w-48 rounded-2xl border border-[#EADAF1] bg-white p-2 shadow-lg"
          >
            <button
              type="button"
              onClick={openPollModal}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-secondary-700 transition hover:bg-[#F7F1FA]"
            >
              <PollIcon size={18} className="text-secondary-600" />
              {t("poll.create")}
            </button>
          </div>
        ) : null}
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 rounded-full border border-[#EADAF1] bg-white px-3 py-2"
        >
          {isOfferOwner ? (
            <button
              type="button"
              onClick={() => setAttachmentMenuOpen((prev) => !prev)}
              className="flex h-10 w-10 items-center justify-center text-secondary-700 transition hover:text-secondary-900"
              aria-label={t("poll.create")}
            >
              <AttachmentIcon size={18} className="text-secondary-700" />
            </button>
          ) : null}
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
      </div>
      {sendError ? (
        <p className="text-xs text-danger-600">{sendError}</p>
      ) : null}
      <Modal
        open={isPollModalOpen}
        title={t("poll.create_title")}
        onClose={closePollModal}
      >
        <div className="space-y-4">
          <label className="space-y-1 text-sm font-semibold text-primary-900">
            <span>{t("poll.question")}</span>
            <input
              value={pollQuestion}
              onChange={(event) => setPollQuestion(event.target.value)}
              className="w-full rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
              placeholder={t("poll.question_placeholder")}
            />
          </label>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-primary-900">
              {t("poll.options")}
            </p>
            {pollOptions.map((option, index) => (
              <div
                key={`poll-option-${index}`}
                className="flex items-center gap-2"
              >
                <input
                  value={option}
                  onChange={(event) =>
                    updatePollOption(index, event.target.value)
                  }
                  className="w-full rounded-2xl border border-[#EADAF1] px-3 py-2 text-sm text-secondary-600"
                  placeholder={t("poll.option_placeholder", {
                    count: index + 1
                  })}
                />
                {pollOptions.length > 2 ? (
                  <button
                    type="button"
                    onClick={() => removePollOption(index)}
                    className="h-10 w-10 rounded-full border border-[#EADAF1] text-sm text-secondary-500 transition hover:bg-[#F7F1FA]"
                    aria-label={t("poll.remove_option")}
                  >
                    x
                  </button>
                ) : null}
              </div>
            ))}
            {pollOptions.length < 10 ? (
              <button
                type="button"
                onClick={addPollOption}
                className="text-xs font-semibold text-secondary-500 transition hover:text-secondary-600"
              >
                {t("poll.add_option")}
              </button>
            ) : null}
          </div>
          <div className="space-y-2 text-sm text-secondary-500">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={pollAllowMultiple}
                onChange={(event) =>
                  setPollAllowMultiple(event.target.checked)
                }
              />
              <span>{t("poll.allow_multiple")}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={pollAllowChange}
                onChange={(event) => setPollAllowChange(event.target.checked)}
              />
              <span>{t("poll.allow_change")}</span>
            </label>
          </div>
          {pollError ? (
            <p className="text-xs text-danger-600">{pollError}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closePollModal}
              className="h-11 w-full rounded-full border border-secondary-500 px-4 text-sm font-semibold text-secondary-500 transition hover:bg-secondary-500/10"
              disabled={pollState === "sending"}
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={handleCreatePoll}
              className="h-11 w-full rounded-full bg-secondary-500 px-4 text-sm font-semibold text-white transition hover:bg-secondary-600 disabled:opacity-60"
              disabled={pollState === "sending"}
            >
              {pollState === "sending" ? t("poll.creating") : t("poll.create")}
            </button>
          </div>
        </div>
      </Modal>
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
            {isOfferOwner && !selectedMessage?.automatic ? (
              <button
                type="button"
                onClick={async () => {
                  if (selectedIsPinned) {
                    await handleUnpinMessage(selectedMessage);
                  } else {
                    await handlePinMessage(selectedMessage);
                  }
                  closeActionModal();
                }}
                className="w-full rounded-2xl border border-[#EADAF1] px-4 py-3 text-sm font-semibold text-primary-900 transition hover:bg-[#F7F1FA]"
              >
                {selectedIsPinned ? t("chat.unpin") : t("chat.pin")}
              </button>
            ) : null}
            {isOfferOwner &&
            selectedMessage?.poll &&
            !selectedMessage.poll?.is_closed ? (
              <button
                type="button"
                onClick={async () => {
                  await handleClosePoll(selectedMessage);
                  closeActionModal();
                }}
                className="w-full rounded-2xl border border-[#EADAF1] px-4 py-3 text-sm font-semibold text-primary-900 transition hover:bg-[#F7F1FA]"
              >
                {t("poll.close")}
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
