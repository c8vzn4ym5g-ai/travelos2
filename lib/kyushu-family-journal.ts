import {
  FLUGEL_BOOKING,
  KAI_YUFUIN_BOOKING,
  NISHIKAWA_CONFIRM,
  NISSAN_RESERVATION,
  SOLARIA_ARRIVAL_BOOKING,
  SOLARIA_RETURN_BOOKING,
  STARLUX_PNR,
  UMEHIBIKI_BOOKING,
} from "@/lib/family-trip";
import type { JournalEntry, Place, TripDetail, TravelRouteSegment } from "@/lib/types";

export const KYUSHU_FAMILY_TRIP_ID = "trip_kyushu_family_2026";
export const KYUSHU_FAMILY_TITLE = "九州家庭慢遊：福岡、大分與阿蘇";
export const KYUSHU_FAMILY_START = "2026-08-30";
export const KYUSHU_FAMILY_END = "2026-09-06";
export const KYUSHU_UMEHIBIKI_ENTRY_ID = "kyushu_arrival";

const TRIP_ID = KYUSHU_FAMILY_TRIP_ID;
const STAMP = "2026-09-09T13:20:00.000Z";

/** Owner-written 梅響 stay. Never rewrite this body. */
export const KYUSHU_UMEHIBIKI_OWNER_TITLE = "大分 奧日田 梅響 溫泉酒店";
export const KYUSHU_UMEHIBIKI_OWNER_BODY =
  "梅酒廠 經營的溫泉旅館。旁邊就是酒廠對外營業的 自製梅酒體驗、和各種梅酒、梅子賣場。\n\n餐廳面向的山，有中國山水畫的味道，選單就是以望出去的景為主題。\n\n全館榻榻米、木地板、進旅館大門後，鞋子就收起來、全館拖鞋/光腳行動，也是有趣。房間空間頗大、私人風呂也夠大、視野開闊。價效比算高。";

const GEO = {
  kmj: { latitude: 32.8373, longitude: 130.8551 },
  tenjin: { latitude: 33.5904, longitude: 130.4017 },
  itoshima: { latitude: 33.5574, longitude: 130.1956 },
  kai: { latitude: 33.2629, longitude: 131.3548 },
  kinrinko: { latitude: 33.2636, longitude: 131.3731 },
  onta: { latitude: 33.3214, longitude: 130.8782 },
  mameda: { latitude: 33.3222, longitude: 130.9413 },
  ume: { latitude: 33.2786, longitude: 130.8519 },
  chojabaru: { latitude: 33.1219, longitude: 131.2398 },
  sujiyu: { latitude: 33.1331, longitude: 131.2286 },
  flugel: { latitude: 33.0488, longitude: 131.2289 },
  oka: { latitude: 32.9733, longitude: 131.3981 },
  nagayu: { latitude: 33.0417, longitude: 131.3822 },
  chikuan: { latitude: 33.1211, longitude: 131.0684 },
  aso: { latitude: 32.8842, longitude: 131.0837 },
  nishikawa: { latitude: 33.5902, longitude: 130.3994 },
} as const;

function journal(
  id: string,
  entryDate: string,
  title: string,
  body: string,
  extra: Partial<JournalEntry> = {},
): JournalEntry {
  return {
    id,
    tripId: TRIP_ID,
    title,
    body,
    entryDate,
    storyPhotoId: extra.storyPhotoId ?? null,
    voiceNoteUrl: extra.voiceNoteUrl ?? null,
    mood: extra.mood ?? null,
    weatherSummary: extra.weatherSummary ?? null,
    aiSummary: extra.aiSummary ?? null,
    createdAt: extra.createdAt ?? STAMP,
    updatedAt: extra.updatedAt ?? STAMP,
  };
}

function place(
  id: string,
  type: Place["type"],
  name: string,
  city: string,
  notes: string,
  address: string | null,
  coordinates: Place["coordinates"],
): Place {
  return {
    id,
    tripId: TRIP_ID,
    type,
    name,
    country: "Japan",
    city,
    address,
    coordinates,
    rating: null,
    notes,
    createdAt: STAMP,
    updatedAt: STAMP,
  };
}

function route(
  id: string,
  date: string,
  fromLabel: string,
  toLabel: string,
  from: TravelRouteSegment["from"],
  to: TravelRouteSegment["to"],
  note: string,
  extra: Partial<TravelRouteSegment> = {},
): TravelRouteSegment {
  return {
    id,
    tripId: TRIP_ID,
    fromLabel,
    toLabel,
    from,
    to,
    transport: extra.transport ?? "car",
    note,
    linkedPlaceId: extra.linkedPlaceId ?? null,
    linkedJournalEntryId: extra.linkedJournalEntryId ?? null,
    linkedPhotoId: extra.linkedPhotoId ?? null,
    visibility: "private",
    createdAt: date + "T00:00:00.000Z",
    updatedAt: STAMP,
  };
}

function ownerUmehibikiEntry(existing: TripDetail): JournalEntry {
  const saved = existing.journalEntries.find(
    (entry) =>
      entry.id === KYUSHU_UMEHIBIKI_ENTRY_ID
      || entry.title.includes("梅響")
      || (entry.body.includes("梅酒廠") && entry.body.includes("私人風呂")),
  );
  if (saved?.body.trim()) {
    return {
      ...saved,
      id: KYUSHU_UMEHIBIKI_ENTRY_ID,
      tripId: TRIP_ID,
      title: saved.title.trim() || KYUSHU_UMEHIBIKI_OWNER_TITLE,
      body: saved.body,
      entryDate: "2026-09-01",
      storyPhotoId: saved.storyPhotoId ?? "trip_kyushu_family_2026_img_1423_jpg",
    };
  }
  return journal(
    KYUSHU_UMEHIBIKI_ENTRY_ID,
    "2026-09-01",
    KYUSHU_UMEHIBIKI_OWNER_TITLE,
    KYUSHU_UMEHIBIKI_OWNER_BODY,
    {
      storyPhotoId: "trip_kyushu_family_2026_img_1423_jpg",
      mood: "期待",
      weatherSummary: "初秋暖晴",
      createdAt: "2026-09-09T10:00:00.000Z",
      updatedAt: "2026-09-09T12:55:03.972Z",
    },
  );
}

function ownerChikuanBody(existing: TripDetail) {
  const saved = existing.journalEntries.find((entry) => entry.id === "kyushu_chikuan" || entry.title.includes("竹庵"));
  if (saved?.body.includes("明太子")) {
    return saved.body;
  }
  return "到了熊本小國町附近，公路旁的餐廳：竹庵。份量大到極度誇張，記憶裡很難抹去的一餐。照片中的炸物套餐¥1200 價效比很高、還包無限量小菜、生雞蛋、明太子。光吃明太子配飯就值回票價。\n\n旅行裡最容易被記住的，往往不是精心安排的名店，而是這種完全超出預期的一餐。";
}

export function kyushuFamilyPlaces(): Place[] {
  return [
    place("p_kmj", "airport", "熊本機場", "Kumamoto", "8/30 取 Serena、9/6 還車起飛。訂位 " + NISSAN_RESERVATION + "。", "熊本縣上益城郡嘉島町", GEO.kmj),
    place("p_solaria_1", "hotel", "Solaria 西鉄ホテル福岡（天神第一段）", "Fukuoka", "8/30–8/31 只睡。確認號 " + SOLARIA_ARRIVAL_BOOKING + "。天神2-2-43。", "福岡市中央區天神2-2-43", GEO.tenjin),
    place("p_tenjin", "attraction", "天神", "Fukuoka", "頭尾兩段的城市底座：落地睡覺、回程逛街與枕頭。", "福岡市中央區天神", GEO.tenjin),
    place("p_itoshima", "attraction", "糸島", "Fukuoka", "9/5 彈性。想去海邊／鄉道再去，不排死。", null, GEO.itoshima),
    place("p_kai", "hotel", "界 由布院", "Yufuin", "8/31–9/1 露天風呂和室。確認號 " + KAI_YUFUIN_BOOKING + "。川上398。", "大分縣由布市湯布院町川上398", GEO.kai),
    place("p_kinrinko", "attraction", "金鱗湖", "Yufuin", "8/31 入界前可選短走。湧水與由布嶽。", "大分縣由布市湯布院町川上", GEO.kinrinko),
    place("p_onta", "attraction", "小鹿田燒之里", "Hita", "9/1 路上。唐臼搗土、登窯。源栄町皿山。0973-29-2020。", "大分縣日田市源栄町皿山", GEO.onta),
    place("p_mameda", "attraction", "豆田町", "Hita", "9/1 城下町。酒蔵／醬油蔵走一圈，城裡吃完再開上梅響。", "大分縣日田市豆田町", GEO.mameda),
    place("p_ume", "hotel", "奧日田溫泉 梅響／うめひびき", "Hita", "9/1–9/2 梅酒與私人風呂。確認號 " + UMEHIBIKI_BOOKING + "。西大山4587。", "大分縣日田市西大山4587", GEO.ume),
    place("p_chojabaru", "attraction", "九重／長者原", "Kokonoe", "9/2 往久住的高原停點。看山，不趕。", "大分縣玖珠郡九重町", GEO.chojabaru),
    place("p_sujiyu", "attraction", "筋湯", "Kokonoe", "9/2 順路溫泉街。想停再停。", "大分縣玖珠郡九重町筋湯", GEO.sujiyu),
    place("p_kuju", "attraction", "久住高原", "Taketa", "Flügel 所在的高原面。星空與牧野。", "大分縣竹田市久住町", GEO.flugel),
    place("p_flugel", "hotel", "フリューゲル久住／Flügel 久住", "Taketa", "9/2–9/3 星空房、朝夕食在旅館。確認號 " + FLUGEL_BOOKING + "。栢木6049-89。", "大分縣竹田市久住町大字栢木6049-89", GEO.flugel),
    place("p_oka", "attraction", "岡城跡", "Taketa", "9/2–9/3 彈性。竹田石垣與風。", "大分縣竹田市", GEO.oka),
    place("p_nagayu", "attraction", "長湯", "Taketa", "9/2–9/3 彈性。碳酸溫泉鄉，順路即可。", "大分縣竹田市長湯", GEO.nagayu),
    place("p_chikuan", "restaurant", "竹庵（小國町）", "Oguni", "公路餐廳。份量與明太子是記憶點。", "熊本縣阿蘇郡小國町", GEO.chikuan),
    place("p_aso", "attraction", "阿蘇", "Aso", "火山地景與赤牛。回福岡或還車路上可串。", "熊本縣阿蘇市", GEO.aso),
    place("p_solaria_2", "hotel", "Solaria 西鉄ホテル福岡（天神第二段）", "Fukuoka", "9/3–9/5 兩晚。確認號 " + SOLARIA_RETURN_BOOKING + "。素泊まり。", "福岡市中央區天神2-2-43", GEO.tenjin),
    place("p_nishikawa", "shopping", "西川ネムリウム 福岡三越", "Fukuoka", "9/4 14:00–15:00 枕頭。確認號 " + NISHIKAWA_CONFIRM + "。三越 B1。", "福岡市中央區天神2-1-1 福岡三越 B1", GEO.nishikawa),
  ];
}

export function kyushuFamilyRoute(): TravelRouteSegment[] {
  return [
    route("r_kmj_tenjin", "2026-08-30", "熊本機場", "天神 Solaria", GEO.kmj, GEO.tenjin, "JX316 落地取 Serena，夜開天神。約 1 小時 15 分。", { linkedPlaceId: "p_solaria_1", linkedJournalEntryId: "kyushu_solaria1" }),
    route("r_tenjin_kai", "2026-08-31", "天神 Solaria", "界 由布院", GEO.tenjin, GEO.kai, "11:00 退房。金鱗湖可選。14:30 入界。", { linkedPlaceId: "p_kai", linkedJournalEntryId: "kyushu_kai" }),
    route("r_kai_onta_ume", "2026-09-01", "界 由布院", "小鹿田／豆田町 → 梅響", GEO.kai, GEO.ume, "先看窯與酒，城裡吃完再開上山。15:00 入梅響。", { linkedPlaceId: "p_ume", linkedJournalEntryId: KYUSHU_UMEHIBIKI_ENTRY_ID }),
    route("r_ume_kuju", "2026-09-02", "梅響", "長者原／筋湯 → Flügel 久住", GEO.ume, GEO.flugel, "高原停點彈性。晚上含晚餐。", { linkedPlaceId: "p_flugel", linkedJournalEntryId: "kyushu_flugel" }),
    route("r_kuju_aso_fukuoka", "2026-09-03", "久住", "岡城／長湯／竹庵／阿蘇 → 天神", GEO.flugel, GEO.tenjin, "高原下來可串竹田、小國、阿蘇，再回福岡第二段。", { linkedPlaceId: "p_solaria_2", linkedJournalEntryId: "kyushu_solaria2" }),
    route("r_tenjin_itoshima", "2026-09-05", "天神", "糸島（彈性）", GEO.tenjin, GEO.itoshima, "想去海邊再去。不住一晚，回到同一間 Solaria。", { linkedPlaceId: "p_itoshima", linkedJournalEntryId: "kyushu_itoshima" }),
    route("r_tenjin_kmj", "2026-09-06", "天神 Solaria", "熊本機場還車", GEO.tenjin, GEO.kmj, "11:00 退房。還車後 JX317 起飛。", { transport: "car", linkedPlaceId: "p_kmj", linkedJournalEntryId: "kyushu_return" }),
  ];
}

export function kyushuFamilyJournals(existing: TripDetail): JournalEntry[] {
  const ume = ownerUmehibikiEntry(existing);
  const chikuanBody = ownerChikuanBody(existing);
  return [
    journal("kyushu_solaria1", "2026-08-30", "熊本落地，天神 Solaria 只睡", `星宇 JX316（${STARLUX_PNR}）臺中清泉崗 → 熊本。Nissan Serena 訂位 ${NISSAN_RESERVATION}，訪客中心走路三分鐘，不用接駁。夜裡開上天神。

第一晚住 Solaria 西鉄ホテル福岡，確認號 ${SOLARIA_ARRIVAL_BOOKING}，天神2-2-43。家庭行程寫得很清楚：不排觀光、不排 REC，只求把行李放下、睡穩。八天自駕從這裡開始。`, { mood: "落地", storyPhotoId: null }),
    journal("kyushu_kai", "2026-08-31", "開向由布院：界的露天風呂和室", `11:00 退天神 Solaria，車子掉頭向東，開進湯布院谷地。星野 界・由布院確認號 ${KAI_YUFUIN_BOOKING}，川上398，14:30 入住。這晚是露天風呂和室，溫泉文化慢慢來——旅館晚餐不能加，想吃燒肉就在谷地另訂。

金鱗湖可以短走一圈，看湧水與由布嶽；想直開到界也可以。主題是泡湯與安靜，不是買伴手禮。`, { mood: "溫泉" }),
    journal("kyushu_onta", "2026-09-01", "小鹿田燒：唐臼與登窯", `往奧日田的路上，先停小鹿田燒之里（日田市源栄町皿山）。看水車唐臼搗土、登窯與窯元生活現場——工藝是這一帶的玩法，不是紀念品店走馬看花。

陶芸館週三休；窯場節奏慢，停多久算多久。看完再下山進城。`, { mood: "工藝" }),
    journal("kyushu_mameda", "2026-09-01", "豆田町：城裡吃完再開上山", `日田城下町豆田町可以走酒蔵與醬油蔵。薰長酒造、原次郎左衛門都在家庭地圖上；中午在城裡解決（和くら或備案和食工房 新），再把車開上梅響。

酒吧藤五郎約 20:00。城裡吃完再開山上，比餓著上山舒服。`, { mood: "城下町" }),
    ume,
    journal("kyushu_chojabaru", "2026-09-02", "九重／長者原：高原先停一下", `梅響退房後往久住，九重連山的長者原是地圖上的高原停點：看山、吹風、不必攻頂。Serena 慢開即可。

這不是打卡站，是把前一晚的梅酒與風呂，換成高原空氣。`, { mood: "高原" }),
    journal("kyushu_sujiyu", "2026-09-02", "筋湯：順路的溫泉街", `長者原旁邊就是筋湯。想停車逛溫泉街、再泡一口，就停；趕路去 Flügel 也沒有錯過。彈性，不寫死。`, { mood: "路上" }),
    journal("kyushu_flugel", "2026-09-02", "久住：Flügel 星空房與朝夕食", `フリューゲル久住確認號 ${FLUGEL_BOOKING}，栢木6049-89。星空房、天然露天風呂，早晚餐都在旅館，家庭本子因此不另寫晚餐店。

高原牧野把節奏放成「住一晚就值得」。入湯稅另計，到店付。`, { mood: "星空" }),
    journal("kyushu_oka_nagayu", "2026-09-02", "岡城跡與長湯：彈性繞一繞", `竹田岡城跡是石垣與風；長湯是碳酸泉鄉。兩處都在家庭地圖的編號停點裡，跟久住同一塊大分高原。

不必全打卡。車在手上，想看城就看城，想泡碳酸就轉進長湯。`, { mood: "彈性" }),
    journal("kyushu_chikuan", "2026-09-02", "小國町附近：竹庵的驚人份量", chikuanBody, { mood: "好吃", storyPhotoId: "trip_kyushu_family_2026_img_1487_jpg" }),
    journal("kyushu_aso", "2026-09-03", "阿蘇：火山地景與赤牛", `小國下來就是阿蘇。火山口把視野拉開，赤牛料理把地景拉回餐桌。語音裡那句帶著玩笑的「赤牛肉、膽固醇」，比導覽詞更像這家人的旅行。

看完火山地景，車子再北上回福岡，準備天神第二段。`, { mood: "地景", storyPhotoId: "trip_kyushu_family_2026_img_1735_jpg" }),
    journal("kyushu_solaria2", "2026-09-03", "天神第二段：Solaria 再住兩晚", `回到同一棟 Solaria 西鉄ホテル福岡，確認號 ${SOLARIA_RETURN_BOOKING}，9/3–9/5 兩晚素泊まり。15:00 入住後，ワンビル週四下午關得早，晚到改去 REC 天神南。

這兩晚不是趕景點，是把溫泉與高原換回城市節奏：百貨、枕頭、想吃再吃。`, { mood: "收尾", storyPhotoId: "trip_kyushu_family_2026_img_1556_jpg" }),
    journal("kyushu_nishikawa", "2026-09-04", "三越西川：枕頭預約那一趟", `福岡三越 B1 西川ネムリウム，確認號 ${NISHIKAWA_CONFIRM}，14:00–15:00。家庭本子裡少數釘死的市區行程。

早上可去 REC 天神ワンビル；枕頭約完，晚上想吃鳥就近 とりくら。市區日子給身體留位，不跟溫泉搶戲。`, { mood: "家庭" }),
    journal("kyushu_itoshima", "2026-09-05", "糸島彈性：想去海邊再去", `第二段 Solaria 多出來的整天。糸島在家庭地圖上，是福岡西側的彈性——海邊、鄉道、不一定下車。

不去也沒有缺一角：天神本身就能把這天過完。去了，再開回同一間飯店睡。`, { mood: "彈性" }),
    journal("kyushu_return", "2026-09-06", "熊本機場還車／起飛", `Solaria 11:00 退。Serena 開回熊本機場還車（${NISSAN_RESERVATION}），星宇 JX317 ${STARLUX_PNR} 起飛回家。

八天骨架：天神起、界、梅響、久住、再回天神。自駕慢遊，不趕。`, { mood: "回家" }),
  ];
}

export function enrichKyushuFamilyTrip(existing: TripDetail): TripDetail {
  const journals = kyushuFamilyJournals(existing);
  const photos = (existing.photos ?? []).map((photo) => {
    if (photo.id.includes("1487")) {
      return { ...photo, caption: "小國町附近的竹庵：份量與明太子。公路旁一餐就記住了。" };
    }
    if (photo.id.includes("1423") || photo.id.includes("1425")) {
      return { ...photo, caption: "奧日田梅響前後：山景、木地板與風呂的日常。" };
    }
    if (photo.id.includes("1556") || photo.id.includes("1560") || photo.id.includes("1570")) {
      return { ...photo, caption: "福岡天神第二段：城市節奏與安靜停頓。" };
    }
    if (photo.id.includes("1735")) {
      return { ...photo, caption: "阿蘇火山地景。赤牛與膽固醇那句玩笑還在。" };
    }
    if (photo.id.includes("1506")) {
      return { ...photo, caption: "小國／阿蘇一帶的路上。" };
    }
    return photo;
  });

  return {
    ...existing,
    title: KYUSHU_FAMILY_TITLE,
    slug: existing.slug || "kyushu-family-fukuoka-oguni-aso-2026",
    summary:
      "8/30–9/6 Serena 自駕。天神 Solaria 頭尾兩段；中間住界・由布院、奧日田梅響、Flügel 久住。路上串小鹿田、豆田町、九重長者原、筋湯、岡城、長湯、竹庵、阿蘇；糸島與金鱗湖保持彈性。不趕打卡。",
    city: "Fukuoka / Oita / Aso",
    country: "Japan",
    startDate: KYUSHU_FAMILY_START,
    endDate: KYUSHU_FAMILY_END,
    visibility: existing.visibility || "private",
    coverPhotoId: existing.coverPhotoId || "trip_kyushu_family_2026_img_1487_jpg",
    journalEntries: journals,
    photos,
    places: kyushuFamilyPlaces(),
    travelRoute: kyushuFamilyRoute(),
    updatedAt: STAMP,
  };
}

export function withKyushuFamilyDates(trip: TripDetail): TripDetail {
  if (trip.id !== KYUSHU_FAMILY_TRIP_ID) {
    return trip;
  }
  return {
    ...trip,
    startDate: KYUSHU_FAMILY_START,
    endDate: KYUSHU_FAMILY_END,
  };
}
