import { apiRequest } from "./api-client";

const PERMISSION_STORAGE_KEY = "groopin:webpush:permission-requested";

const isSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const getContentEncoding = () => {
  if (typeof PushManager !== "undefined") {
    const encodings = PushManager.supportedContentEncodings;
    if (Array.isArray(encodings) && encodings.length > 0) {
      return encodings[0];
    }
  }
  return "aesgcm";
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
};

const getVapidKey = () =>
  process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY || "";

const buildPayload = (subscription) => {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint,
    publicKey: json.keys?.p256dh || "",
    authToken: json.keys?.auth || "",
    contentEncoding: getContentEncoding()
  };
};

const saveSubscription = async (subscription) => {
  const payload = buildPayload(subscription);
  if (!payload.endpoint || !payload.publicKey || !payload.authToken) {
    return { status: "invalid-subscription" };
  }
  await apiRequest("web-push/subscriptions", {
    method: "POST",
    body: payload
  });
  return { status: "saved" };
};

export const ensureWebPushSubscription = async (options = {}) => {
  const {
    requestPermission = true,
    forcePrompt = false
  } = options;
  if (!isSupported()) {
    return { status: "unsupported" };
  }

  const vapidKey = getVapidKey();
  if (!vapidKey) {
    return { status: "missing-key" };
  }

  if (Notification.permission === "default") {
    if (!requestPermission) {
      return { status: "default" };
    }
    const alreadyRequested =
      window.localStorage.getItem(PERMISSION_STORAGE_KEY) === "1";
    if (alreadyRequested && !forcePrompt) {
      return { status: "skipped" };
    }
    const result = await Notification.requestPermission();
    if (result !== "default") {
      window.localStorage.setItem(PERMISSION_STORAGE_KEY, "1");
    }
    if (result !== "granted") {
      return { status: result };
    }
  }

  if (Notification.permission !== "granted") {
    return { status: Notification.permission };
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    });
  }

  return saveSubscription(subscription);
};

export const removeWebPushSubscription = async () => {
  if (!isSupported()) {
    return { status: "unsupported" };
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    return { status: "no-registration" };
  }

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    return { status: "no-subscription" };
  }

  const { endpoint } = subscription.toJSON() || {};
  if (endpoint) {
    try {
      await apiRequest("web-push/subscriptions", {
        method: "DELETE",
        body: { endpoint }
      });
    } catch {
      // Best effort cleanup only.
    }
  }

  await subscription.unsubscribe();
  return { status: "removed" };
};
