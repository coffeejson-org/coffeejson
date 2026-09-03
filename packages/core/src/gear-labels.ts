// GENERATED from registries/gear.json by tools/gen-gear-labels.mjs — do not edit by hand.
//
// The registry's label for every gear id and alias. `gearLabel` resolves a known id
// through this map, because a document that names registered gear carries no display
// string of its own: the id is the wire form and the label is the edge (01-overview.md,
// principle 2).
//
// Keyed by language tag, and `en` is the only one the registry can supply today —
// `gear.json` carries one `label` per entry. Adding `ja` is then a DATA change and
// not a reshape: give the registry a per-entry `label_i18n` and this generator emits
// the extra blocks beside `en`. Until then `gearLabelsFor` falls back to `en`, which
// is right rather than merely convenient: most of these strings are brand and model
// names that do not translate.

export const GEAR_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  en: Object.freeze({
    "1zpresso-jx": "1Zpresso JX",
    "1zpresso-k-ultra": "1Zpresso K-Ultra",
    "1zpresso-zp6": "1Zpresso ZP6",
    "aeropress": "AeroPress",
    "april": "April Brewer",
    "april-hybrid-brewer": "April Hybrid Brewer",
    "baratza-270": "Baratza Sette 270",
    "baratza-encore": "Baratza Encore",
    "baratza-encore-esp": "Baratza Encore ESP",
    "baratza-sette-270": "Baratza Sette 270",
    "baratza-virtuoso-plus": "Baratza Virtuoso+",
    "bialetti-moka-express": "Bialetti Moka Express",
    "breville-bambino": "Breville Bambino",
    "breville-bambino-plus": "Breville Bambino Plus",
    "breville-barista-express": "Breville Barista Express",
    "breville-barista-pro": "Breville Barista Pro",
    "breville-dual-boiler": "Breville Dual Boiler",
    "cafec-flower": "CAFEC Flower Dripper",
    "cafelat-robot": "Cafelat Robot",
    "cezve": "Cezve",
    "chemex": "Chemex",
    "clever-dripper": "Clever Dripper",
    "comandante-c40": "Comandante C40",
    "decent-de1": "Decent DE1",
    "df54": "DF54",
    "df64": "DF64",
    "ecm-synchronika": "ECM Synchronika",
    "eureka-mignon-specialita": "Eureka Mignon Specialità",
    "eureka-mignon-zero": "Eureka Mignon Zero",
    "eureka-specialita": "Eureka Mignon Specialità",
    "fellow-espresso-series-1": "Fellow Espresso Series 1",
    "fellow-ode": "Fellow Ode",
    "fellow-opus": "Fellow Opus",
    "fellow-stagg-x": "Fellow Stagg [X]",
    "fellow-stagg-xf": "Fellow Stagg [XF]",
    "flair-58": "Flair 58",
    "flair-neo-flex": "Flair NEO Flex",
    "flair-pro-2": "Flair PRO 2",
    "french-press": "French press",
    "gaggia-classic-pro": "Gaggia Classic Pro",
    "graycano": "Graycano Dripper",
    "gs3": "La Marzocco GS3",
    "hario-switch": "Hario V60 Switch",
    "hario-v60": "Hario V60",
    "hario-v60-mugen": "Hario V60 MUGEN",
    "hario-v60-neo": "Hario V60 Dripper NEO",
    "ims-precision": "IMS Precision basket",
    "kalita-101": "Kalita 101",
    "kalita-wave": "Kalita Wave",
    "kinu-m47": "Kinu M47",
    "kono-meimon": "Kōno Meimon Dripper",
    "la-marzocco-gs3": "La Marzocco GS3",
    "la-marzocco-linea-micra": "La Marzocco Linea Micra",
    "la-marzocco-linea-mini": "La Marzocco Linea Mini",
    "lagom-01": "Option-O Lagom 01",
    "lagom-mini": "Option-O Lagom Mini",
    "lagom-p64": "Option-O Lagom P64",
    "lelit-bianca": "Lelit Bianca",
    "lelit-mara-x": "Lelit Mara X",
    "linea-micra": "La Marzocco Linea Micra",
    "mahlkonig-e80": "Mahlkönig E80",
    "mahlkonig-ek43": "Mahlkönig EK43",
    "mazzer-philos": "Mazzer Philos",
    "mazzer-super-jolly": "Mazzer Super Jolly",
    "miicoffee-df64": "DF64",
    "moka-pot": "Moka pot",
    "nextlevel-pulsar": "NextLevel Pulsar Brewer",
    "niche-duo": "Niche Duo",
    "niche-zero": "Niche Zero",
    "option-o-lagom-01": "Option-O Lagom 01",
    "option-o-lagom-mini": "Option-O Lagom Mini",
    "option-o-lagom-p64": "Option-O Lagom P64",
    "orea": "Orea Brewer",
    "origami": "Origami Dripper",
    "profitec-go": "Profitec Go",
    "profitec-pro-600": "Profitec Pro 600",
    "pullman-876": "Pullman 876 Filtration basket",
    "pulsar": "NextLevel Pulsar Brewer",
    "rancilio-silvia": "Rancilio Silvia",
    "rocket-appartamento": "Rocket Appartamento",
    "sage-bambino": "Breville Bambino",
    "sage-barista-express": "Breville Barista Express",
    "sage-dual-boiler": "Breville Dual Boiler",
    "siphon": "Siphon brewer",
    "slayer-1-group": "Slayer Single Group",
    "slayer-espresso": "Slayer Espresso",
    "slayer-single-group": "Slayer Single Group",
    "stagg-xf": "Fellow Stagg [XF]",
    "timemore-078": "Timemore Sculptor 078",
    "timemore-078s": "Timemore Sculptor 078S",
    "timemore-b75": "Timemore B75",
    "timemore-c2": "Timemore Chestnut C2",
    "timemore-c3": "Timemore C3",
    "timemore-chestnut-c2": "Timemore Chestnut C2",
    "timemore-sculptor-078": "Timemore Sculptor 078",
    "timemore-sculptor-078s": "Timemore Sculptor 078S",
    "toddy": "Toddy Cold Brew System",
    "toddy-cold-brew-system": "Toddy Cold Brew System",
    "torch-mountain": "Torch Mountain Dripper",
    "tricolate": "Tricolate",
    "turin-df54": "DF54",
    "turin-df64": "DF64",
    "varia-vs3": "Varia VS3",
    "verve-dwell": "Verve Dwell Dripper",
    "vst-precision": "VST Precision basket",
    "wafo-basket": "Wafo Spirit basket",
    "wafo-spirit": "Wafo Spirit basket",
    "weber-eg-1": "Weber EG-1",
    "weber-hg-2": "Weber HG-2",
    "weber-key": "Weber Key",
    "weber-unibasket": "Weber Unibasket",
    "xbloom-studio": "xBloom Studio",
    "zerno-z1": "Zerno Z1",
  }),
});

/** The registry's labels for a document's `lang`, falling back to `en`. */
export function gearLabelsFor(lang?: string): Readonly<Record<string, string>> {
  if (typeof lang === "string") {
    const exact = GEAR_LABELS[lang];
    if (exact) return exact;
    // A tag narrows: `ja-JP` takes `ja` before it takes `en`.
    const base = GEAR_LABELS[lang.split("-")[0] ?? ""];
    if (base) return base;
  }
  return GEAR_LABELS["en"]!;
}
