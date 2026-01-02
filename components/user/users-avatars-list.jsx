"use client";

import React from "react";
import Image from "next/image";

export default function UsersAvatarsList({ users = [], lastItemText }) {
  const visible = users.slice(0, 3);
  return (
    <div className="flex items-center">
      {visible.map((user, index) => (
        <div
          key={user.id || index}
          className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-primary-500 text-[10px] font-semibold text-white"
          style={{
            marginLeft: index === 0 ? 0 : -8,
            zIndex: visible.length - index
          }}
        >
          {(() => {
            const avatarUrl =
              user?.avatar_image_url ||
              user?.avatar_url ||
              user?.avatar ||
              user?.image ||
              user?.profile_image_url ||
              user?.profile_image;
            const usesDefaultImage =
              user?.uses_default_image === true ||
              Number(user?.uses_default_image) === 1;
            if (!usesDefaultImage && avatarUrl) {
              return (
            <Image
              src={avatarUrl}
              alt={user?.name || user?.first_name || "User avatar"}
              width={28}
              height={28}
              className="h-full w-full object-cover"
            />
              );
            }
            return (
            <span>
              {(user?.first_name?.[0] || "G") +
                (user?.last_name?.[0] || "")}
            </span>
            );
          })()}
        </div>
      ))}
      {lastItemText ? (
        <div className="ml-2 rounded-full border border-[#EADAF1] px-2 py-1 text-xs text-secondary-400">
          {lastItemText}
        </div>
      ) : null}
    </div>
  );
}
