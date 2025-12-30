const getLocalizedText = (value, locale) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (locale && typeof value[locale] === "string") return value[locale];
    if (typeof value.en === "string") return value.en;
    if (typeof value.fr === "string") return value.fr;
    if (typeof value.ar === "string") return value.ar;
    const firstString = Object.values(value).find(
      (entry) => typeof entry === "string"
    );
    return firstString || "";
  }
  return String(value);
};

export { getLocalizedText };
