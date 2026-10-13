/** Curated language choices for the community survey, using stable ISO codes. */
export const languages = [
    { value: "ar", label: "Arabic" },
    { value: "zh", label: "Chinese" },
    { value: "nl", label: "Dutch" },
    { value: "en", label: "English" },
    { value: "fr", label: "French" },
    { value: "de", label: "German" },
    { value: "hi", label: "Hindi" },
    { value: "it", label: "Italian" },
    { value: "ja", label: "Japanese" },
    { value: "pl", label: "Polish" },
    { value: "pt", label: "Portuguese" },
    { value: "ru", label: "Russian" },
    { value: "es", label: "Spanish" },
    { value: "ta", label: "Tamil" },
    { value: "tr", label: "Turkish" },
    { value: "uk", label: "Ukrainian" },
] as const;

/** ISO 639-1 language codes for the searchable extended catalogue. */
const codes =
    "aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu".split(
        " ",
    );
/** Resolve stable codes to English names, retaining existing labels for curated choices. */
const names = new Intl.DisplayNames(["en"], { type: "language" });
/** All supported languages, shared by validation, search and audience reports. */
export const allLanguages = codes
    .map((value) => ({
        value,
        label: languages.find((language) => language.value === value)?.label ?? names.of(value)!,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "en"));
