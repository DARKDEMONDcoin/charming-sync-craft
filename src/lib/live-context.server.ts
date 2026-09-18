/**
 * «الوعي اللحظي»: يعطي كل موظف إحساساً حقيقياً بالزمن (تاريخ وساعة بالتوقيت المحلي
 * للعلامة + التاريخ الهجري + المواسم القادمة) وبالأحداث الجارية في العالم عبر بحث حيّ
 * متعدد المصادر مجاني بالكامل — بلا اختلاق ولا معلومات قديمة.
 *
 * الترتيب: SearXNG → DuckDuckGo → Google News RSS → GDELT → Hacker News → ويكيبيديا،
 * بالتوازي مع مصادر منظّمة (طقس، صرف، كريبتو، رياضة، مواقيت) حسب نيّة السؤال.
 */

export { nowBlock, nowAnchorLine, nowFacts, timezoneForCountry, currencyForCountry, upcomingOccasions } from "./time-awareness.server";
export type { LiveRow } from "./live-sources.server";

import type { LiveRow } from "./live-sources.server";
import { nowFacts, currencyForCountry } from "./time-awareness.server";

/** هل يحتاج الطلب حقائق لحظية من العالم (أخبار، رياضة، أسعار، ترند، طقس، «آخر/أحدث»)؟ */
export function needsLiveFacts(text: string): boolean {
  return /(آخر|أحدث|احدث|اخر)\s|النهارده|النهاردة|اليوم|امبارح|أمس|بكرة|غدا|غداً|الأسبوع ده|هذا الأسبوع|الشهر ده|هذا الشهر|دلوقتي|دلوقت|الآن|الان|حالياً|حاليا|خبر|أخبار|اخبار|عاجل|ترند|ترندات|trending|news|latest|مباراة|ماتش|الماتش|الدوري|كأس|بطولة|فاز|هدف|نتيجة المباراة|سعر|أسعار|اسعار|الدولار|اليورو|الريال|الجنيه|الذهب|البورصة|بيتكوين|عملة|كريبتو|مهرجان|حفل|إعلان|اطلاق|إطلاق|صدر|توفي|رحيل|انتخابات|الطقس|درجة الحرارة|حرارة|مطر|موسم|رمضان|العيد|الجمعة البيضاء|بلاك فرايداي|اليوم الوطني|مواقيت|الصلاة|أذان|تحديث|إصدار|نسخة/u.test(
    text,
  );
}

/**
 * ينظّف الرسالة إلى استعلام بحث قصير مفيد: نحذف نداء الموظف وصيغ الطلب وأسئلة
 * الوقت نفسها (الساعة كام، تاريخ النهاردة) لأنها تُجاب من الخادم لا من البحث،
 * فيبقى الموضوع الحقيقي الذي يستحق بحثاً حياً.
 */
function queryOf(text: string): string {
  return text
    .replace(/^(يا\s+\w+[،,]?\s*)/u, "")
    .replace(
      /(اكتب|اكتبلي|اعملي|اعمل|جهّز|جهز|منشور|بوست|بوستات|من فضلك|لو سمحت|عايز اعرف|عايز|عاوز|أريد|قوللي|قولي|ممكن|ابحث|إبحث|شوفلي)/gu,
      " ",
    )
    // أسئلة الزمن البحتة: الخادم يعرفها، والبحث عنها يفسد الاستعلام.
    .replace(
      /(الساعة\s*(كام|كم)?|تاريخ\s*(النهارده|النهاردة|اليوم)|إيه\s*تاريخ|ايه\s*تاريخ|بالظبط|بالضبط|احنا\s*في\s*(شهر|سنة|يوم)?|كم\s*الساعة|what\s*time|today'?s?\s*date)/gu,
      " ",
    )
    .replace(
      /(^|\s)(و?إيه|و?ايه|و?ما هي|و?ما هو|هل|من فضلك|كمان|بردو|برضه|و?التاريخ|و)(\s|$)/gu,
      " ",
    )
    // كلمات الزمن الشائعة: تضيّق البحث بلا فائدة لأن التوقيت محقون أصلاً.
    .replace(/(النهارده|النهاردة|دلوقتي|دلوقت|حالياً|حاليا|الآن|الان|اليوم|هذه الأيام)/gu, " ")
    .replace(/[؟?]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[و،,\s]+/u, "")
    .trim()
    .slice(0, 140);
}

const STOP = new Set([
  "على","في","من","عن","الى","إلى","مع","هذا","هذه","اللي","التي","الذي","كان","اليوم",
  "امس","أمس","ماتش","نتيجة","اخر","آخر","أحدث","احدث","the","and","for","with","what","when",
]);

function norm(text: string) {
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u0652]/g, "");
}

/** يبقي فقط النتائج التي تخص فعلاً موضوع السؤال — كثير من نسخ البحث تعيد ضجيجاً. */
function relevantRows(rows: LiveRow[], query: string): LiveRow[] {
  const tokens = norm(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3 && !STOP.has(t));
  if (!tokens.length) return rows;
  // تصفية صارمة: نتائج البحث العام ترجع ضجيجاً كثيراً (صفحات دعم، إعلانات) ولا
  // شيء أسوأ من حقيقة «لحظية» بلا علاقة بالسؤال.
  return rows.filter((r) => {
    const hay = norm(`${r.title} ${r.snippet}`);
    return tokens.some((t) => hay.includes(t));
  });
}

/** نيّة السؤال — تحدّد أي مصادر منظّمة نستدعي بجانب البحث العام. */
function intentOf(text: string) {
  return {
    news: /خبر|أخبار|اخبار|عاجل|حدث|ترند|news|انتخابات|قرار|إعلان|اعلان/u.test(text),
    tech: /تقنية|تكنولوجيا|ذكاء اصطناعي|AI|إصدار|نسخة|تحديث|تطبيق|منصة|شركة|launch|startup/iu.test(
      text,
    ),
    weather: /الطقس|طقس|حرارة|مطر|جو|رطوبة|weather/u.test(text),
    fx: /سعر الصرف|الدولار|اليورو|الجنيه|الريال|الدرهم|عملات|صرف|تحويل/u.test(text),
    crypto: /بيتكوين|كريبتو|عملة رقمية|إيثيريوم|ايثيريوم|crypto|bitcoin/iu.test(text),
    sports: /مباراة|ماتش|الدوري|كأس|بطولة|فاز|هدف|نادي|فريق|ريال مدريد|الأهلي|الزمالك|الهلال|النصر/u.test(
      text,
    ),
    prayer: /مواقيت|الصلاة|أذان|اذان|الفجر|المغرب|الإفطار|السحور/u.test(text),
  };
}

function teamNameIn(text: string): string {
  const known = [
    "الأهلي","الزمالك","الهلال","النصر","الاتحاد","الأهلي السعودي","ريال مدريد","برشلونة",
    "ليفربول","مانشستر سيتي","مانشستر يونايتد","تشيلسي","أرسنال","بايرن ميونخ","باريس سان جيرمان",
    "المصري","بيراميدز","الترجي","الرجاء","الوداد",
  ];
  const map: Record<string, string> = {
    "الأهلي": "Al Ahly",
    "الزمالك": "Zamalek",
    "الهلال": "Al Hilal",
    "النصر": "Al Nassr",
    "الاتحاد": "Al Ittihad",
    "ريال مدريد": "Real Madrid",
    برشلونة: "Barcelona",
    ليفربول: "Liverpool",
    "مانشستر سيتي": "Manchester City",
    "مانشستر يونايتد": "Manchester United",
    تشيلسي: "Chelsea",
    "أرسنال": "Arsenal",
    "بايرن ميونخ": "Bayern Munich",
    "باريس سان جيرمان": "Paris SG",
    "المصري": "Al Masry",
    بيراميدز: "Pyramids",
    "الترجي": "Esperance",
    "الرجاء": "Raja Casablanca",
    الوداد: "Wydad",
  };
  const found = known.find((k) => text.includes(k));
  return found ? (map[found] ?? found) : "";
}

const COUNTRY_CITY: Record<string, { city: string; country: string }> = {
  EG: { city: "Cairo", country: "Egypt" },
  SA: { city: "Riyadh", country: "Saudi Arabia" },
  AE: { city: "Dubai", country: "United Arab Emirates" },
  KW: { city: "Kuwait City", country: "Kuwait" },
  QA: { city: "Doha", country: "Qatar" },
  BH: { city: "Manama", country: "Bahrain" },
  OM: { city: "Muscat", country: "Oman" },
  JO: { city: "Amman", country: "Jordan" },
  MA: { city: "Casablanca", country: "Morocco" },
  DZ: { city: "Algiers", country: "Algeria" },
  TN: { city: "Tunis", country: "Tunisia" },
  IQ: { city: "Baghdad", country: "Iraq" },
  LY: { city: "Tripoli", country: "Libya" },
  SD: { city: "Khartoum", country: "Sudan" },
};

export type LiveOptions = {
  /** رمز دولة العلامة — يضبط سوق الأخبار والعملة والمدينة الافتراضية. */
  country?: string | null;
  /** مدينة العلامة إن كانت معروفة (للطقس والمواقيت). */
  city?: string | null;
  timeZone?: string;
};

async function settled<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

/**
 * يجلب حقائق لحظية حقيقية عن موضوع الرسالة من عدة مصادر بالتوازي.
 * يعيد كتلة جاهزة للحقن، أو إقراراً صريحاً بعدم وجود مصدر (بدل الاختلاق).
 */
export async function liveFactsBlock(
  message: string,
  budgetMs = 13_000,
  opts: LiveOptions = {},
): Promise<string> {
  // سقف صارم: مهما تعثّرت المصادر أو تباطأت المرايا، الرد على المستخدم لا يتأخر.
  // ومع ذلك لا نرجع فارغين: ما وصل من أرقام رسمية قبل انتهاء المهلة يُسلَّم كما هو.
  const { withBudget } = await import("./net-resilience.server");
  const partial = { text: "" };
  const out = await withBudget(liveFactsInner(message, budgetMs, opts, partial), budgetMs + 2_000, "");
  return out || partial.text;
}

/** المدن المذكورة صراحة في السؤال تتقدّم على مدينة العلامة (طقس/مواقيت). */
const CITY_HINTS: Record<string, { city: string; country: string }> = {
  "القاهرة": { city: "Cairo", country: "Egypt" },
  "الإسكندرية": { city: "Alexandria", country: "Egypt" },
  "الرياض": { city: "Riyadh", country: "Saudi Arabia" },
  "جدة": { city: "Jeddah", country: "Saudi Arabia" },
  "مكة": { city: "Mecca", country: "Saudi Arabia" },
  "المدينة": { city: "Medina", country: "Saudi Arabia" },
  "دبي": { city: "Dubai", country: "United Arab Emirates" },
  "أبوظبي": { city: "Abu Dhabi", country: "United Arab Emirates" },
  "الدوحة": { city: "Doha", country: "Qatar" },
  "الكويت": { city: "Kuwait City", country: "Kuwait" },
  "عمّان": { city: "Amman", country: "Jordan" },
  "بغداد": { city: "Baghdad", country: "Iraq" },
  "بيروت": { city: "Beirut", country: "Lebanon" },
  "الدار البيضاء": { city: "Casablanca", country: "Morocco" },
  "تونس": { city: "Tunis", country: "Tunisia" },
  "الجزائر": { city: "Algiers", country: "Algeria" },
  "الخرطوم": { city: "Khartoum", country: "Sudan" },
};

async function liveFactsInner(
  message: string,
  budgetMs: number,
  opts: LiveOptions,
  partial: { text: string } = { text: "" },
): Promise<string> {
  const q = queryOf(message);
  if (!q) return "";
  const started = Date.now();
  const left = () => budgetMs - (Date.now() - started);
  const intent = intentOf(message);
  const code = (opts.country ?? "EG").toUpperCase();
  const hinted = Object.entries(CITY_HINTS).find(([name]) => message.includes(name))?.[1];
  const place = hinted ?? COUNTRY_CITY[code] ?? COUNTRY_CITY["EG"]!;
  const city = hinted?.city || opts.city?.trim() || place.city;

  const sources = await import("./live-sources.server");
  const searchMs = Math.min(Math.max(left() - 1_500, 4_000), 10_000);

  // 1) بحث عام + أخبار بالتوازي — أول ما يصل يُستخدم، والفشل لا يعطّل الباقي.
  const webTasks: Promise<LiveRow[]>[] = [
    settled(
      (async () => {
        const { searxPoolSearch } = await import("./searx-pool.server");
        return (await searxPoolSearch(q, searchMs)) as LiveRow[];
      })(),
      [],
    ),
    settled(sources.duckSearch(q, { ms: searchMs }), []),
  ];
  if (intent.news || /\b(20\d\d)\b/.test(q) || true)
    webTasks.push(
      settled(sources.googleNewsSearch(q, { country: code, ms: searchMs }), []),
      settled(sources.gdeltNews(q, { ms: searchMs }), []),
    );
  if (intent.tech) webTasks.push(settled(sources.hackerNewsSearch(q, { ms: searchMs }), []));
  // بدائل دائمة تعمل بالتوازي: لو حُجب محرك أو سقط مزوّد يبقى هناك من يجيب.
  webTasks.push(
    settled(
      (async () => {
        const extra = await import("./live-sources-extra.server");
        return extra.backupWebSearch(q, { ms: searchMs });
      })(),
      [],
    ),
  );

  // 2) مصادر منظّمة حسب النيّة — إجابات قاطعة بأرقام حقيقية.
  const structuredTasks: Promise<string>[] = [];
  // كل نوع بيانات له سلسلة بدائل داخلية (مزوّد أول ثم ثانٍ ثم ثالث).
  const extra = await import("./live-sources-extra.server");
  if (intent.weather) structuredTasks.push(settled(extra.weatherAny(city, { ms: searchMs }), ""));
  if (intent.fx)
    structuredTasks.push(
      settled(
        extra.fxAny("USD", [currencyForCountry(code), "EUR", "GBP", "SAR", "AED", "EGP"], {
          ms: searchMs,
        }),
        "",
      ),
    );
  if (intent.crypto) structuredTasks.push(settled(extra.cryptoAny(undefined, { ms: searchMs }), ""));
  if (intent.prayer)
    structuredTasks.push(settled(extra.prayerAny(city, place.country, { ms: searchMs }), ""));
  if (intent.sports) {
    const team = teamNameIn(message);
    if (team) structuredTasks.push(settled(sources.teamMatches(team, { ms: searchMs }), ""));
  }

  const [webResults, structured] = await Promise.all([
    Promise.all(webTasks),
    Promise.all(structuredTasks),
  ]);

  let rows = webResults.flatMap((r) => relevantRows(r, q).slice(0, 6));
  // لو أسقطت التصفية كل شيء، نأخذ أفضل ما جاءت به مصادر الأخبار الخام (الأحدث زمنياً).
  if (!rows.length) rows = webResults.flatMap((r) => r.filter((x) => x.date).slice(0, 4));
  const seen = new Set<string>();
  let unique = rows.filter((r) => r.url && r.title && !seen.has(r.url) && seen.add(r.url));

  // الحداثة أهم من الترتيب الأصلي: الأسئلة عن «الآن/اليوم/آخر» لا تُجاب بخبر عمره شهور.
  const stamp = (r: LiveRow) => {
    if (!r.date) return 0;
    const iso = /^\d{14}$/.test(r.date)
      ? `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}T${r.date.slice(8, 10)}:${r.date.slice(10, 12)}:00Z`
      : r.date.replace(/^(\d{8})T(\d{6})Z$/, "$1T$2Z");
    const t = Date.parse(iso);
    return Number.isNaN(t) ? 0 : t;
  };
  const dated = unique.filter((r) => stamp(r) > 0).sort((a, b) => stamp(b) - stamp(a));
  const undated = unique.filter((r) => stamp(r) === 0);
  const wantsFresh = /اليوم|النهارده|النهاردة|الآن|الان|دلوقتي|عاجل|آخر|اخر|أحدث|احدث|أمس|امبارح/u.test(
    message,
  );
  const cutoff = Date.now() - 14 * 86_400_000;
  const fresh = dated.filter((r) => stamp(r) >= cutoff);
  unique = [...(wantsFresh && fresh.length ? fresh : dated), ...undated].slice(0, 10);

  // 3) محاولة ثانية للأخبار وحدها: تحت الحمل المتوازي تنتهي مهلة المصادر أحياناً،
  //    وإعادة نداء واحد خفيف أرخص بكثير من إجابة «لم أجد مصدراً».
  if (!unique.length && left() > 3_000) {
    const retry = await settled(
      sources.googleNewsSearch(q, { country: code, ms: Math.min(left(), 7_000) }),
      [],
    );
    const relevant = relevantRows(retry, q);
    unique.push(...(relevant.length ? relevant : retry).slice(0, 8));
  }

  // 4) ويكيبيديا كملاذ أخير للحقائق الثابتة.
  if (!unique.length && left() > 2_500) {
    const wiki = await settled(sources.wikipediaSearch(q, { ms: Math.min(left(), 6_000) }), []);
    unique.push(...relevantRows(wiki, q).slice(0, 5));
  }

  // 5) الضمانة الأخيرة: خلاصات إخبارية مباشرة (بلا محرك بحث إطلاقاً).
  if (!unique.length && left() > 2_000) {
    const feeds = await settled(extra.arabicFeeds({ ms: Math.min(left(), 6_000) }), []);
    const relevant = relevantRows(feeds, q);
    unique.push(...(relevant.length ? relevant : feeds.slice(0, 5)).slice(0, 6));
  }

  const facts = structured.filter(Boolean);
  const f = nowFacts(opts.timeZone ?? "Asia/Riyadh");

  if (!unique.length && !facts.length)
    return [
      "## حقائق لحظية",
      `بحثتَ الآن (${f.iso} ${f.clock}) عن «${q}» في عدة محركات ولم تُرجع نتائج موثوقة.`,
      "قل للمستخدم بصراحة في سطر واحد أنك بحثت ولم تجد مصدراً مؤكداً، واطلب التفصيلة (النتيجة/الاسم/التاريخ) ثم نفّذ طلبه فوراً عليها. ممنوع اختلاق نتيجة أو رقم.",
    ].join("\n");

  return [
    `## حقائق لحظية — بحث حيّ نُفّذ الآن (${f.iso} ${f.clock} ${f.timeZone}) عن «${q}»`,
    ...facts.map((s) => `- ${s}`),
    ...unique.map((r) => {
      let host = r.source;
      try {
        host = new URL(r.url).hostname.replace(/^www\./, "");
      } catch {
        /* رابط غير قياسي */
      }
      return `- ${r.title}${r.snippet ? ` — ${r.snippet}` : ""}${r.date ? ` [${r.date}]` : ""} (${host})`;
    }),
    "اعتمد هذه النتائج حرفياً كمصدر وحيد لأي حدث جارٍ أو رقم أو سعر. أي رقم مذكور أعلاه (سعر صرف، عملة، حرارة، موعد) هو رقم رسمي مؤكد: اذكره صراحة مع مصدره وتاريخه بدل قول «لا يوجد رقم مؤكد». الامتناع لا يجوز إلا إذا كان الرقم غير موجود هنا فعلاً. إن تعارضت المصادر فاذكر الأرجح وقل إن التفاصيل قيد التأكيد. لا تضف أسماء أو أرقاماً غير موجودة هنا.",
  ].join("\n");
}

/** لقطة «ما الذي يحدث الآن» لمهام الخلفية (البريفنج/الأوتوبايلوت) بلا سؤال محدد. */
export async function ambientPulse(
  opts: LiveOptions & { topics?: string[] } = {},
  budgetMs = 9_000,
): Promise<string> {
  const code = (opts.country ?? "EG").toUpperCase();
  const sources = await import("./live-sources.server");
  const extra = await import("./live-sources-extra.server");
  const tasks: Promise<LiveRow[]>[] = [
    settled(sources.googleNewsTop({ country: code, ms: budgetMs }), []),
    // بديل مباشر بلا محرك بحث، يعمل حتى لو سقطت أخبار جوجل.
    settled(extra.arabicFeeds({ ms: budgetMs, limit: 12 }), []),
    ...(opts.topics ?? [])
      .slice(0, 2)
      .map((t) => settled(sources.googleNewsSearch(t, { country: code, ms: budgetMs }), [])),
  ];
  const rows = (await Promise.all(tasks)).flat();
  const seen = new Set<string>();
  const unique = rows.filter((r) => r.title && !seen.has(r.title) && seen.add(r.title)).slice(0, 8);
  if (!unique.length) return "";
  const f = nowFacts(opts.timeZone ?? "Asia/Riyadh");
  return [
    `## ما يحدث الآن في السوق (${f.iso} ${f.clock})`,
    ...unique.map((r) => `- ${r.title}${r.date ? ` [${r.date}]` : ""}`),
    "استخدمها فقط إن كانت ذات صلة بالعلامة، ولا تفتعل ربطاً.",
  ].join("\n");
}
