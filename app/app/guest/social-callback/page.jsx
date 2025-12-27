import React, { Suspense } from "react";

import SocialCallbackClient from "./social-callback-client";

export default function SocialCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-secondary-500">
            Processing login
          </p>
        </div>
      }
    >
      <SocialCallbackClient />
    </Suspense>
  );
}
