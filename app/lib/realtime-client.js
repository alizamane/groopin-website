"use client";

import Echo from "laravel-echo";
import Pusher from "pusher-js";

import { getToken } from "./session";

let echoInstance = null;

const buildAuthHeaders = () => {
  const token = getToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json"
  };
};

const resolveBaseUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  return baseUrl.replace(/\/$/, "");
};

export const getEcho = () => {
  if (typeof window === "undefined") return null;
  if (echoInstance) return echoInstance;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  if (!key) return null;

  const scheme = process.env.NEXT_PUBLIC_PUSHER_SCHEME || "https";
  const host = process.env.NEXT_PUBLIC_PUSHER_HOST;
  const port = Number(
    process.env.NEXT_PUBLIC_PUSHER_PORT ||
      (scheme === "https" ? 443 : 80)
  );

  window.Pusher = Pusher;

  echoInstance = new Echo({
    broadcaster: "pusher",
    key,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    wsHost: host || undefined,
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === "https",
    encrypted: scheme === "https",
    disableStats: true,
    enabledTransports: ["ws", "wss"],
    authEndpoint: `${resolveBaseUrl()}/broadcasting/auth`,
    auth: {
      headers: buildAuthHeaders()
    }
  });

  return echoInstance;
};

export const disconnectEcho = () => {
  if (!echoInstance) return;
  echoInstance.disconnect();
  echoInstance = null;
};
