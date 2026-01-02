"use client";

import { useEffect, useState } from "react";

const isDateLikeType = (type) => type === "date" || type === "time";

const resolveInputType = (type) => {
  if (!isDateLikeType(type)) return type;
  if (typeof document === "undefined") return type;

  const probe = document.createElement("input");
  probe.setAttribute("type", type);
  return probe.type === type ? type : "text";
};

const getFallbackMeta = (type) => {
  if (type === "date") {
    return {
      placeholder: "YYYY-MM-DD",
      pattern: "[0-9]{4}-[0-9]{2}-[0-9]{2}"
    };
  }
  if (type === "time") {
    return {
      placeholder: "HH:MM",
      pattern: "[0-9]{2}:[0-9]{2}"
    };
  }
  return {
    placeholder: undefined,
    pattern: undefined
  };
};

const useSupportedInputType = (type) => {
  const [resolvedType, setResolvedType] = useState(type);

  useEffect(() => {
    setResolvedType(resolveInputType(type));
  }, [type]);

  return resolvedType;
};

export { getFallbackMeta, isDateLikeType, resolveInputType };

export default useSupportedInputType;
