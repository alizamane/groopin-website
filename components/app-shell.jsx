"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import AnimatedLogo from "./ui/animated-logo";
import {
  Bars3Icon,
  BellIcon,
  ChatBubbleLeftRightIcon,
  ChevronDoubleUpIcon,
  HomeIcon,
  MegaphoneIcon
} from "./ui/heroicons";
import UserAvatar from "./user/user-avatar";
import { useI18n } from "./i18n-provider";
import { apiRequest } from "../app/lib/api-client";
import { clearSession, getToken, getUser, setSession } from "../app/lib/session";
import {
  ensureWebPushSubscription,
  removeWebPushSubscription
} from "../app/lib/web-push";

export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadGroopsCount, setUnreadGroopsCount] = useState(0);
  const [webPushReady, setWebPushReady] = useState(false);

  const menuItems = [
    { label: t("Favorites"), href: "/app/auth/favorites" },
    { label: t("Participating"), href: "/app/auth/participating" },
    { label: t("Settings"), href: "/app/auth/drawer/settings" },
    { label: t("FAQ"), href: "/app/auth/drawer/faq" },
    { label: t("Terms"), href: "/app/auth/terms-and-conditions" },
    { label: t("policy of use"), href: "/app/auth/policy-of-use" },
    { label: t("Us"), href: "/app/auth/drawer/us" }
  ];

  const refreshNotificationsCount = useCallback(async () => {
    try {
      const payload = await apiRequest("notifications?lite=1");
      const data = Array.isArray(payload?.data) ? payload.data : [];
      const computed = data.filter((item) => !item?.read_at).length;
      const metaCount =
        typeof payload?.meta?.unread_count === "number"
          ? payload.meta.unread_count
          : null;
      const count = metaCount !== null ? metaCount : computed;
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  const refreshGroopsCount = useCallback(
    async (activeConversationId = null) => {
      try {
        const payload = await apiRequest("conversations?lite=1");
        const data = payload?.data || [];
        const metaCount = payload?.meta?.has_unread_messages_count;
        const computed = data.reduce((sum, conversation) => {
          if (
            activeConversationId &&
            Number(conversation?.id) === Number(activeConversationId)
          ) {
            return sum;
          }
          if (typeof conversation?.unread_messages === "number") {
            return sum + conversation.unread_messages;
          }
          if (typeof conversation?.has_unread_messages_count === "number") {
            return sum + conversation.has_unread_messages_count;
          }
          if (conversation?.has_unread_messages) {
            return sum + 1;
          }
          return sum;
        }, 0);

        if (activeConversationId) {
          setUnreadGroopsCount(computed);
          return;
        }

        if (typeof metaCount === "number") {
          setUnreadGroopsCount(metaCount);
          return;
        }

        setUnreadGroopsCount(computed);
      } catch {
        setUnreadGroopsCount(0);
      }
    },
    []
  );

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/app/guest/login");
      return;
    }

    const cachedUser = getUser();
    if (cachedUser) {
      setUser(cachedUser);
    }

    apiRequest("user")
      .then((payload) => {
        setUser(payload?.data || null);
        if (token) {
          setSession(token, payload?.data);
        }
      })
      .catch((error) => {
        if (error?.status === 401) {
          clearSession();
          router.replace("/app/guest/login");
        }
      });

    refreshNotificationsCount();
    refreshGroopsCount();
    const groopsInterval = setInterval(refreshGroopsCount, 8000);
    const notificationsInterval = setInterval(refreshNotificationsCount, 12000);
    return () => {
      clearInterval(groopsInterval);
      clearInterval(notificationsInterval);
    };
  }, [refreshGroopsCount, refreshNotificationsCount, router]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const match = pathname.match(/\/app\/auth\/conversations\/(\d+)/);
    const activeConversationId = match ? Number(match[1]) : null;
    if (activeConversationId) {
      refreshGroopsCount(activeConversationId);
    }
  }, [pathname, refreshGroopsCount]);

  useEffect(() => {
    if (!user || webPushReady) {
      return;
    }
    setWebPushReady(true);
    ensureWebPushSubscription().catch(() => {});
  }, [user, webPushReady]);

  useEffect(() => {
    const handleNotificationsUpdate = (event) => {
      const detailCount = event?.detail?.unreadCount;
      if (typeof detailCount === "number") {
        setUnreadCount(detailCount);
        return;
      }
      refreshNotificationsCount();
    };

    window.addEventListener("notifications:updated", handleNotificationsUpdate);
    return () =>
      window.removeEventListener(
        "notifications:updated",
        handleNotificationsUpdate
      );
  }, [refreshNotificationsCount]);

  const handleLogout = async () => {
    try {
      await removeWebPushSubscription();
    } catch {
      // ignore
    }
    try {
      await apiRequest("logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      clearSession();
      router.replace("/app/guest/login");
    }
  };

  const isExact = (path) => pathname === path;
  const isPath = (path) => pathname === path || pathname.startsWith(`${path}/`);

  const tabs = [
    {
      label: t("Home"),
      href: "/app/auth/drawer/tabs",
      active: isExact("/app/auth/drawer/tabs") || isPath("/app/auth/offers"),
      icon: HomeIcon
    },
    {
      label: t("Offers"),
      href: "/app/auth/drawer/tabs/my-offers",
      active:
        isPath("/app/auth/drawer/tabs/my-offers") ||
        isPath("/app/auth/my-offers"),
      icon: MyOffersIcon
    },
    {
      label: t("Requests"),
      href: "/app/auth/drawer/tabs/requests",
      active: isPath("/app/auth/drawer/tabs/requests"),
      icon: RequestsIcon
    },
    {
      label: t("Groops"),
      href: "/app/auth/drawer/tabs/groops",
      active:
        isPath("/app/auth/drawer/tabs/groops") ||
        isPath("/app/auth/conversations"),
      icon: GroopsIcon,
      badge: unreadGroopsCount
    },
    {
      label: t("Profile"),
      href: "/app/auth/drawer/tabs/profile",
      active:
        isPath("/app/auth/drawer/tabs/profile") ||
        isPath("/app/auth/profile"),
      icon: ProfileIcon
    }
  ];

  return (
    <div className="relative min-h-screen bg-white">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-[#EADAF1] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center px-4 md:px-6">
          <button
            type="button"
            className="text-primary-800"
            onClick={() => setDrawerOpen(true)}
          >
            <Bars3Icon size={26} className="text-primary-800" />
          </button>
          <div className="flex flex-1 justify-center">
            <AnimatedLogo width={90} height={40} />
          </div>
          <button
            type="button"
            onClick={() => router.push("/app/auth/drawer/notifications")}
            className="relative flex items-center justify-center text-primary-800 transition"
          >
            <BellIcon size={22} className="text-primary-800" />
            {unreadCount > 0 ? (
              <span className="absolute -right-2 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-20 md:px-6">
        {children}
      </main>

      {drawerOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 h-full w-80 bg-white px-6 pb-6 pt-10 shadow-xl transition ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {user ? (
          <div className="space-y-6 border-b border-[#D0D0D4] pb-6">
          <div className="flex flex-col items-center gap-3">
              <UserAvatar user={user} size={90} withBorder />
              <p className="text-2xl font-semibold text-primary-800">
                {user.name || `${user.first_name} ${user.last_name}`}
              </p>
              <div className="rounded-full border border-[#EADAF1] px-3 py-2 text-sm text-secondary-400">
                {t("number_of_created_offers", {
                  count: user.owning_offers_count || 0
                })}
              </div>
            </div>
          </div>
        ) : null}

        <nav className="mt-6 space-y-3 text-sm font-medium text-secondary-400">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href} className="block">
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            className="mt-4 text-left text-sm font-medium text-secondary-400"
            onClick={() => (window.location.href = "mailto:contact@groopin.io")}
          >
            {t("Contact us")}
          </button>
        </nav>

        <div className="mt-10 text-center text-sm text-secondary-400">
          Groopin - V 1.1.1
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-4 w-full rounded-full border border-neutral-300 py-2 text-sm font-semibold text-primary-900"
        >
          {t("Logout")}
        </button>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#EADAF1] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl justify-between text-xs font-semibold">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const badge = tab.badge || 0;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-1 ${
                  tab.active ? "text-secondary-500" : "text-secondary-400"
                }`}
                aria-current={tab.active ? "page" : undefined}
              >
                <span className="relative flex items-center justify-center">
                  {tab.label === t("Profile") ? (
                    <Icon active={tab.active} user={user} />
                  ) : (
                    <Icon
                      size={22}
                      className={
                        tab.active ? "text-secondary-500" : "text-secondary-400"
                      }
                    />
                  )}
                  {badge > 0 ? (
                    <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-secondary-500 px-1 text-[10px] text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function ProfileIcon({ active, user }) {
  if (user) {
    return (
      <span
        className={`rounded-full ${active ? "ring-2 ring-secondary-500 ring-offset-2 ring-offset-white" : ""}`}
      >
        <UserAvatar user={user} size={26} withBorder={active} />
      </span>
    );
  }
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={active ? "text-secondary-500" : "text-secondary-400"}
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 19c1.8-3.5 5-5 8-5s6.2 1.5 8 5" />
    </svg>
  );
}

const MyOffersIcon = MegaphoneIcon;
const RequestsIcon = ChevronDoubleUpIcon;
const GroopsIcon = ChatBubbleLeftRightIcon;
