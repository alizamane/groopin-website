const DEFAULT_NOTIFICATION_PATH = "/app/auth/drawer/tabs/requests";

const isValidAppPath = (path) => typeof path === "string" && path.startsWith("/app/");

const sanitizeUrl = (value) => {
  if (!value) return "";
  try {
    const parsed = new URL(value, self.location.origin);
    if (parsed.origin !== self.location.origin) return "";
    if (!isValidAppPath(parsed.pathname)) return "";
    return parsed.href;
  } catch {
    return "";
  }
};

const resolveActionUrl = (data) => {
  const action = data?.action;
  const offerId = data?.offer_id;
  const conversationId = data?.conversation_id;

  switch (action) {
    case "offer.approved":
      return offerId ? `/app/auth/my-offers/${offerId}` : "";
    case "offer.refused":
      return "/app/auth/drawer/tabs/my-offers";
    case "offer.created":
    case "offer.draft":
    case "offer.draft.reminder":
      return offerId ? `/app/auth/my-offers/${offerId}/edit` : "";
    case "participation.request.received":
    case "participation.request.canceled":
    case "participation.request.removed":
    case "participation.request.exits":
      return "/app/auth/drawer/tabs/requests";
    case "participation.request.accepted":
    case "participation.request.rejected":
      return "/app/auth/drawer/tabs/requests";
    case "participation.offerremoved":
      return "/app/auth/participating";
    case "participation.leavereview":
      return offerId ? `/app/auth/profile/offer-rating/${offerId}` : "";
    case "message.created":
      return conversationId ? `/app/auth/conversations/${conversationId}` : "";
    case "offer.signaled":
      return offerId ? `/app/auth/my-offers/${offerId}` : "";
    case "account.deleted":
      return "/app/guest/login";
    default:
      return offerId ? `/app/auth/my-offers/${offerId}` : "";
  }
};

const resolveNotificationUrl = (data) => {
  const actionUrl = resolveActionUrl(data);
  if (actionUrl && isValidAppPath(actionUrl)) {
    return new URL(actionUrl, self.location.origin).href;
  }
  const safeUrl = sanitizeUrl(data?.url);
  if (safeUrl) {
    return safeUrl;
  }
  return new URL(DEFAULT_NOTIFICATION_PATH, self.location.origin).href;
};

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {};
    }
  }

  const data = payload.data || {};
  const title = payload.title || data.title || "Groopin";
  const body = payload.body || data.body || "";
  const resolvedUrl = resolveNotificationUrl(data);

  const options = {
    body,
    data: { ...data, url: resolvedUrl }
  };

  if (payload.icon) {
    options.icon = payload.icon;
  }
  if (payload.badge) {
    options.badge = payload.badge;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const safeUrl = sanitizeUrl(event.notification?.data?.url);
  const url =
    safeUrl || new URL(DEFAULT_NOTIFICATION_PATH, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (clientList) => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
        return null;
      }
    )
  );
});
