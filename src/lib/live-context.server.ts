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

/** ينظّف الرسالة إلى استعلام بحث قصير مفيد. */
function queryOf(text: string): string {
  return text
    .replace(/^(يا\s+\w+[،,]?\s*)/u, "")
    .replace(
      /(اكتب|اكتبلي|اعملي|اعمل|جهّز|جهز|منشور|بوست|بوستات|من فضلك|لو سمحت|عايز|عاوز|أريد)/gu,
      " ",
    )
    .replace(/\s+/g, " ")
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
  const hit = rows.filter((r) => {
    const hay = norm(`${r.title} ${r.snippet}`);
    return tokens.some((t) => hay.includes(t));
  });
  // لو التصفية أفرغت كل شيء، النتائج الخام أفضل من لا شيء (خاصة أخبار العناوين القصيرة).
  return hit.length ? hit : rows.slice(0, 5);
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
  const q = queryOf(message);
  if (!q) return "";
  const started = Date.now();
  const left = () => budgetMs - (Date.now() - started);
  const intent = intentOf(message);
  const code = (opts.country ?? "EG").toUpperCase();
  const place = COUNTRY_CITY[code] ?? COUNTRY_CITY["EG"]!;
  const city = opts.city?.trim() || place.city;

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

  // 2) مصادر منظّمة حسب النيّة — إجابات قاطعة بأرقام حقيقية.
  const structuredTasks: Promise<string>[] = [];
  if (intent.weather) structuredTasks.push(settled(sources.weatherFor(city, { ms: searchMs }), ""));
  if (intent.fx)
    structuredTasks.push(
      settled(
        sources.fxRates("USD", [currencyForCountry(code), "EUR", "GBP", "SAR", "AED", "EGP"], {
          ms: searchMs,
        }),
        "",
      ),
    );
  if (intent.crypto) structuredTasks.push(settled(sources.cryptoPrices(undefined, { ms: searchMs }), ""));
  if (intent.prayer)
    structuredTasks.push(settled(sources.prayerTimes(city, place.country, { ms: searchMs }), ""));
  if (intent.sports) {
    const team = teamNameIn(message);
    if (team) structuredTasks.push(settled(sources.teamMatches(team, { ms: searchMs }), ""));
  }

  const [webResults, structured] = await Promise.all([
    Promise.all(webTasks),
    Promise.all(structuredTasks),
  ]);

  const rows = webResults.flatMap((r) => relevantRows(r, q).slice(0, 6));
  const seen = new Set<string>();
  const unique = rows
    .filter((r) => r.url && r.title && !seen.has(r.url) && seen.add(r.url))
    .slice(0, 10);

  // 3) ويكيبيديا كملاذ أخير للحقائق الثابتة.
  if (!unique.length && left() > 2_500) {
    const wiki = await settled(sources.wikipediaSearch(q, { ms: Math.min(left(), 6_000) }), []);
    unique.push(...relevantRows(wiki, q).slice(0, 5));
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
    "اعتمد هذه النتائج حرفياً كمصدر وحيد لأي حدث جارٍ أو رقم أو سعر. إن تعارضت المصادر فاذكر الأرجح وقل إن التفاصيل قيد التأكيد. لا تضف أسماء أو أرقاماً غير موجودة هنا.",
  ].join("\n");
}

/** لقطة «ما الذي يحدث الآن» لمهام الخلفية (البريفنج/الأوتوبايلوت) بلا سؤال محدد. */
export async function ambientPulse(
  opts: LiveOptions & { topics?: string[] } = {},
  budgetMs = 9_000,
): Promise<string> {
  const code = (opts.country ?? "EG").toUpperCase();
  const sources = await import("./live-sources.server");
  const tasks: Promise<LiveRow[]>[] = [
    settled(sources.googleNewsTop({ country: code, ms: budgetMs }), []),
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
