import type { JournalEntry, Photo, Place, TripDetail } from "@/lib/types";

/** Specialty/series metadata only. Never prepend this onto a journal title. */
export const VANITY_CREW_SERIES = "愛慕虛榮團";
export const VANITY_CREW_SERIES_ALIASES = ["Vanity Crew", "爱慕虚荣团", "愛慕虛榮團"] as const;

export const VANITY_CREW_MAPLE_JOURNAL_IDS = [
  "trip_kyoto_maple_arashiyama",
  "trip_kyoto_maple_ginkaku",
  "trip_kyoto_maple_higashiyama",
  "trip_kyoto_maple_crew_notes",
] as const;

export const VANITY_CREW_JOURNAL_TITLES = {
  trip_kyoto_maple_arashiyama: "嵐山翠嵐：溫泉飯店裡的楓葉禁區",
  trip_kyoto_maple_ginkaku: "銀閣寺線",
  trip_kyoto_maple_higashiyama: "東山朱色",
  trip_kyoto_maple_crew_notes: "京都四人怎麼一起玩開心",
} as const;

export const VANITY_CREW_HELD_TRIP_IDS = [
  "trip_kyoto_maple_tofukuji_path",
  "trip_kyoto_maple",
] as const;

const MAPLE_JOURNAL_ID_SET = new Set<string>(VANITY_CREW_MAPLE_JOURNAL_IDS);
const HELD_TRIP_ID_SET = new Set<string>(VANITY_CREW_HELD_TRIP_IDS);

type IngestPhoto = Partial<Photo> & {
  date?: string;
  sourceTime?: string;
  sourceRecords?: Array<{ driveId?: string | null }>;
};

function isoNow() {
  return "2022-11-15T00:00:00.000Z";
}

function driveIdFromPhoto(photo: IngestPhoto) {
  const fromKey = photo.storageKey?.startsWith("/api/trips/media?id=")
    ? photo.storageKey.slice("/api/trips/media?id=".length)
    : null;
  return photo.sourceRecords?.find((record) => record.driveId)?.driveId || fromKey || null;
}

function photoTakenAt(photo: IngestPhoto) {
  if (photo.takenAt) {
    return photo.takenAt;
  }
  const day = photo.date?.slice(0, 10);
  if (!day) {
    return null;
  }
  const time = photo.sourceTime && /^\d{2}:\d{2}/.test(photo.sourceTime) ? photo.sourceTime : "00:00:00";
  return `${day}T${time}.000Z`;
}

function normalizePhoto(photo: IngestPhoto, tripId: string, index: number): Photo | null {
  const driveId = driveIdFromPhoto(photo);
  const id = photo.id || (driveId ? `photo_${tripId}_${driveId}` : `photo_${tripId}_${index}`);
  const storageKey = photo.storageKey?.startsWith("http") || photo.storageKey?.startsWith("/")
    ? photo.storageKey
    : driveId
      ? `/api/trips/media?id=${driveId}`
      : "";
  if (!storageKey) {
    return null;
  }
  return {
    id,
    tripId,
    storageKey,
    originalFilename: photo.originalFilename || `maple-${index + 1}.jpg`,
    caption: photo.caption ?? null,
    takenAt: photoTakenAt(photo),
    coordinates: photo.coordinates ?? null,
    cameraMake: photo.cameraMake ?? null,
    cameraModel: photo.cameraModel ?? null,
    createdAt: photo.createdAt || isoNow(),
  };
}

function normalizePlace(place: Partial<Place>, tripId: string, index: number): Place {
  return {
    id: place.id || `place_${tripId}_${index + 1}`,
    tripId,
    type: place.type || "attraction",
    name: place.name?.trim() || `地点 ${index + 1}`,
    country: place.country || "Japan",
    city: place.city || "Kyoto",
    address: place.address ?? null,
    coordinates: place.coordinates ?? null,
    rating: place.rating ?? null,
    notes: place.notes ?? null,
    createdAt: place.createdAt || isoNow(),
    updatedAt: place.updatedAt || isoNow(),
  };
}

const SERIES_TITLE_PREFIX = /^\s*(爱慕虚荣团|愛慕虛榮團)\s*[·•:：]?\s*/u;

/** Simplified-only glyphs. Skip 1:1 chars and ambiguous pairs (松/鬆, 面/麵, 只/隻). */
const S2T: Record<string, string> = {
  爱: "愛", 虚: "虛", 荣: "榮", 团: "團", 岚: "嵐", 银: "銀", 阁: "閣", 线: "線",
  东: "東", 选: "選", 枫: "楓", 叶: "葉", 温: "溫", 饭: "飯", 里: "裡", 区: "區",
  题: "題", 个: "個", 么: "麼", 开: "開", 进: "進", 这: "這", 为: "為", 写: "寫",
  红: "紅", 门: "門", 顾: "顧", 与: "與", 蓝: "藍", 来: "來", 们: "們", 发: "發",
  对: "對", 还: "還", 过: "過", 时: "時", 后: "後", 会: "會", 说: "說", 从: "從",
  经: "經", 现: "現", 点: "點", 处: "處", 号: "號", 长: "長", 车: "車", 边: "邊",
  样: "樣", 给: "給", 让: "讓", 当: "當", 无: "無", 关: "關", 见: "見", 问: "問",
  间: "間", 乐: "樂", 气: "氣", 头: "頭", 体: "體", 内: "內", 国: "國", 书: "書",
  华: "華", 产: "產", 单: "單", 干: "幹", 并: "並", 广: "廣", 应: "應", 张: "張",
  录: "錄", 忆: "憶", 怀: "懷", 态: "態", 总: "總", 恋: "戀", 恳: "懇", 恶: "惡",
  恼: "惱", 悬: "懸", 惊: "驚", 惧: "懼", 惨: "慘", 惯: "慣", 愤: "憤", 愿: "願",
  懒: "懶", 戏: "戲", 战: "戰", 户: "戶", 执: "執", 扩: "擴", 扫: "掃", 扬: "揚",
  扰: "擾", 抚: "撫", 报: "報", 担: "擔", 拟: "擬", 拥: "擁", 择: "擇", 挂: "掛",
  挥: "揮", 捞: "撈", 损: "損", 换: "換", 据: "據", 揽: "攬", 搅: "攪", 携: "攜",
  摄: "攝", 摆: "擺", 摇: "搖", 摊: "攤", 数: "數", 旧: "舊", 显: "顯", 晓: "曉",
  暂: "暫", 术: "術", 机: "機", 杀: "殺", 权: "權", 条: "條", 杨: "楊", 杰: "傑",
  构: "構", 枪: "槍", 标: "標", 栋: "棟", 栏: "欄", 树: "樹", 桥: "橋", 梦: "夢",
  检: "檢", 楼: "樓", 樱: "櫻", 横: "橫", 欢: "歡", 欧: "歐", 残: "殘", 毁: "毀",
  毕: "畢", 汇: "匯", 汉: "漢", 汤: "湯", 沟: "溝", 没: "沒", 泪: "淚", 泽: "澤",
  洁: "潔", 浅: "淺", 浊: "濁", 测: "測", 济: "濟", 浑: "渾", 浓: "濃", 涟: "漣",
  润: "潤", 涧: "澗", 涨: "漲", 涩: "澀", 渊: "淵", 渐: "漸", 渔: "漁", 渗: "滲",
  湾: "灣", 湿: "濕", 满: "滿", 滤: "濾", 滥: "濫", 滨: "濱", 滩: "灘", 潜: "潛",
  灯: "燈", 灵: "靈", 灾: "災", 灿: "燦", 炉: "爐", 炼: "煉", 炽: "熾", 烁: "爍",
  烂: "爛", 烛: "燭", 烟: "煙", 烦: "煩", 烧: "燒", 烫: "燙", 热: "熱", 爷: "爺",
  牵: "牽", 牺: "犧", 状: "狀", 犹: "猶", 独: "獨", 狭: "狹", 狮: "獅", 狱: "獄",
  猎: "獵", 猪: "豬", 猫: "貓", 献: "獻", 玛: "瑪", 环: "環", 玺: "璽", 珑: "瓏",
  琼: "瓊", 瑶: "瑤", 电: "電", 画: "畫", 畅: "暢", 疗: "療", 疯: "瘋", 痒: "癢",
  瘪: "癟", 瘫: "癱", 瘾: "癮", 皱: "皺", 盏: "盞", 盐: "鹽", 监: "監", 盖: "蓋",
  盘: "盤", 睁: "睜", 瞒: "瞞", 瞩: "矚", 矫: "矯", 矶: "磯", 矿: "礦", 码: "碼",
  砖: "磚", 砚: "硯", 碍: "礙", 硕: "碩", 确: "確", 礼: "禮", 祯: "禎", 祷: "禱",
  祸: "禍", 禅: "禪", 离: "離", 种: "種", 积: "積", 称: "稱", 秽: "穢", 税: "稅",
  稳: "穩", 穷: "窮", 窃: "竊", 窍: "竅", 窑: "窯", 窜: "竄", 窝: "窩", 窥: "窺",
  竖: "豎", 竞: "競", 笔: "筆", 筝: "箏", 笼: "籠", 筑: "築", 筛: "篩", 筹: "籌",
  简: "簡", 签: "簽", 篮: "籃", 篱: "籬", 类: "類", 粮: "糧", 紧: "緊", 纠: "糾",
  纤: "纖", 约: "約", 级: "級", 纪: "紀", 纬: "緯", 纯: "純", 纱: "紗", 纲: "綱",
  纳: "納", 纵: "縱", 纷: "紛", 纸: "紙", 纹: "紋", 纺: "紡", 纽: "紐", 练: "練",
  组: "組", 细: "細", 织: "織", 终: "終", 绊: "絆", 绍: "紹", 结: "結", 绕: "繞",
  绘: "繪", 络: "絡", 绝: "絕", 统: "統", 绢: "絹", 绣: "繡", 继: "繼", 绩: "績",
  绪: "緒", 续: "續", 绮: "綺", 绳: "繩", 维: "維", 绵: "綿", 绷: "繃", 绸: "綢",
  综: "綜", 绽: "綻", 绿: "綠", 缀: "綴", 缆: "纜", 缉: "緝", 缎: "緞", 缓: "緩",
  缔: "締", 缕: "縷", 编: "編", 缘: "緣", 缚: "縛", 缝: "縫", 缠: "纏", 缩: "縮",
  缪: "繆", 缮: "繕", 缴: "繳", 网: "網", 罗: "羅", 罚: "罰", 罢: "罷", 翘: "翹",
  耸: "聳", 耻: "恥", 聂: "聶", 聋: "聾", 职: "職", 联: "聯", 聪: "聰", 肃: "肅",
  肠: "腸", 肤: "膚", 肾: "腎", 肿: "腫", 胀: "脹", 胁: "脅", 胆: "膽", 胶: "膠",
  脉: "脈", 脏: "臟", 脐: "臍", 脑: "腦", 脚: "腳", 脱: "脫", 脸: "臉", 腻: "膩",
  腾: "騰", 舰: "艦", 舱: "艙", 艰: "艱", 艳: "豔", 艺: "藝", 节: "節", 芜: "蕪",
  芦: "蘆", 苇: "葦", 苍: "蒼", 苏: "蘇", 茎: "莖", 茧: "繭", 荆: "荊", 荐: "薦",
  荚: "莢", 荞: "蕎", 荟: "薈", 荡: "蕩", 荤: "葷", 荧: "熒", 药: "藥", 莱: "萊",
  莲: "蓮", 获: "獲", 莹: "瑩", 莺: "鶯", 萝: "蘿", 萤: "螢", 营: "營", 萧: "蕭",
  萨: "薩", 葱: "蔥", 蒋: "蔣", 蓦: "驀", 蔷: "薔", 蔼: "藹", 蕴: "蘊", 虏: "虜",
  虑: "慮", 虫: "蟲", 虽: "雖", 虾: "蝦", 蚀: "蝕", 蚁: "蟻", 蛮: "蠻", 蛰: "蟄",
  蜕: "蛻", 蜗: "蝸", 蝇: "蠅", 蝉: "蟬", 衔: "銜", 补: "補", 衬: "襯", 袄: "襖",
  袜: "襪", 袭: "襲", 装: "裝", 裤: "褲", 观: "觀", 规: "規", 觅: "覓", 视: "視",
  览: "覽", 觉: "覺", 觊: "覬", 觌: "覿", 觞: "觴", 触: "觸", 誉: "譽", 计: "計",
  订: "訂", 认: "認", 讥: "譏", 讨: "討", 训: "訓", 议: "議", 讯: "訊", 记: "記",
  讲: "講", 讳: "諱", 讶: "訝", 许: "許", 论: "論", 讼: "訟", 讽: "諷", 设: "設",
  访: "訪", 证: "證", 评: "評", 识: "識", 诈: "詐", 诉: "訴", 词: "詞", 译: "譯",
  试: "試", 诗: "詩", 诚: "誠", 话: "話", 诞: "誕", 诠: "詮", 诡: "詭", 询: "詢",
  该: "該", 详: "詳", 诫: "誡", 语: "語", 误: "誤", 诱: "誘", 请: "請", 诸: "諸",
  诺: "諾", 读: "讀", 课: "課", 谁: "誰", 调: "調", 谅: "諒", 谈: "談", 谊: "誼",
  谋: "謀", 谍: "諜", 谎: "謊", 谐: "諧", 谓: "謂", 谕: "諭", 谗: "讒", 谚: "諺",
  谜: "謎", 谢: "謝", 谣: "謠", 谤: "謗", 谦: "謙", 谨: "謹", 谩: "謾", 谬: "謬",
  谭: "譚", 谱: "譜", 谴: "譴", 贝: "貝", 贞: "貞", 负: "負", 贡: "貢", 财: "財",
  责: "責", 贤: "賢", 败: "敗", 账: "賬", 货: "貨", 质: "質", 贩: "販", 贪: "貪",
  贫: "貧", 贬: "貶", 购: "購", 贯: "貫", 贱: "賤", 贴: "貼", 贵: "貴", 贷: "貸",
  贸: "貿", 费: "費", 贺: "賀", 贼: "賊", 贾: "賈", 资: "資", 赋: "賦", 赌: "賭",
  赏: "賞", 赐: "賜", 赔: "賠", 赖: "賴", 赚: "賺", 赛: "賽", 赞: "贊", 赠: "贈",
  赢: "贏", 赵: "趙", 赶: "趕", 趋: "趨", 跃: "躍", 践: "踐", 跻: "躋", 踊: "踴",
  踌: "躊", 踪: "蹤", 踬: "躓", 蹒: "蹣", 躯: "軀", 轨: "軌", 轩: "軒", 转: "轉",
  轮: "輪", 软: "軟", 轰: "轟", 轴: "軸", 轻: "輕", 载: "載", 轿: "轎", 较: "較",
  辄: "輒", 辅: "輔", 辆: "輛", 辈: "輩", 辉: "輝", 辍: "輟", 辑: "輯", 输: "輸",
  辕: "轅", 辖: "轄", 辗: "輾", 辙: "轍", 辞: "辭", 达: "達", 迁: "遷", 运: "運",
  远: "遠", 违: "違", 连: "連", 迟: "遲", 迹: "跡", 适: "適", 逊: "遜", 递: "遞",
  逻: "邏", 遗: "遺", 遥: "遙", 邮: "郵", 邻: "鄰", 郑: "鄭", 酝: "醞", 酱: "醬",
  酿: "釀", 释: "釋", 鉴: "鑑", 针: "針", 钉: "釘", 钓: "釣", 钗: "釵", 钙: "鈣",
  钝: "鈍", 钞: "鈔", 钟: "鐘", 钢: "鋼", 钥: "鑰", 钦: "欽", 钩: "鉤", 钮: "鈕",
  钱: "錢", 钳: "鉗", 钵: "缽", 钻: "鑽", 钾: "鉀", 铁: "鐵", 铃: "鈴", 铅: "鉛",
  铜: "銅", 铝: "鋁", 铠: "鎧", 铡: "鍘", 铣: "銑", 铨: "銓", 铮: "錚", 铲: "鏟",
  铸: "鑄", 铺: "鋪", 链: "鏈", 销: "銷", 锁: "鎖", 锄: "鋤", 锅: "鍋", 锈: "鏽",
  锋: "鋒", 锌: "鋅", 锐: "銳", 错: "錯", 锚: "錨", 锡: "錫", 锣: "鑼", 锤: "錘",
  锥: "錐", 锦: "錦", 键: "鍵", 锯: "鋸", 锰: "錳", 锹: "鍬", 锻: "鍛", 镀: "鍍",
  镇: "鎮", 镐: "鎬", 镜: "鏡", 镰: "鐮", 闪: "閃", 闭: "閉", 闰: "閏", 闲: "閒",
  闷: "悶", 闸: "閘", 闹: "鬧", 闺: "閨", 闻: "聞", 闽: "閩", 阀: "閥", 阅: "閱",
  阎: "閻", 阐: "闡", 阑: "闌", 阔: "闊", 队: "隊", 阳: "陽", 阴: "陰", 阵: "陣",
  阶: "階", 际: "際", 陆: "陸", 陈: "陳", 陕: "陝", 陨: "隕", 险: "險", 随: "隨",
  隐: "隱", 隶: "隸", 难: "難", 雾: "霧", 静: "靜", 韩: "韓", 韵: "韻", 页: "頁",
  顶: "頂", 顷: "頃", 项: "項", 顺: "順", 须: "須", 顽: "頑", 顿: "頓", 颁: "頒",
  颂: "頌", 预: "預", 颅: "顱", 领: "領", 颇: "頗", 颈: "頸", 颊: "頰", 频: "頻",
  颖: "穎", 颗: "顆", 颜: "顏", 额: "額", 颠: "顛", 颤: "顫", 风: "風", 飘: "飄",
  飞: "飛", 饥: "飢", 饮: "飲", 饯: "餞", 饰: "飾", 饱: "飽", 饲: "飼", 饵: "餌",
  饶: "饒", 饺: "餃", 饼: "餅", 饿: "餓", 馀: "餘", 馆: "館", 馈: "饋", 馊: "餿",
  馋: "饞", 馍: "饃", 馏: "餾", 馒: "饅", 马: "馬", 驭: "馭", 驮: "馱", 驯: "馴",
  驰: "馳", 驱: "驅", 驳: "駁", 驴: "驢", 驶: "駛", 驹: "駒", 驻: "駐", 驼: "駝",
  驾: "駕", 驿: "驛", 骂: "罵", 骄: "驕", 骆: "駱", 骇: "駭", 验: "驗", 骏: "駿",
  骑: "騎", 骗: "騙", 骚: "騷", 骞: "騫", 骡: "騾", 骤: "驟", 鱼: "魚", 鲁: "魯",
  鲍: "鮑", 鲜: "鮮", 鲤: "鯉", 鲸: "鯨", 鳃: "鰓", 鳄: "鱷", 鳍: "鰭", 鳖: "鱉",
  鳞: "鱗", 鸟: "鳥", 鸡: "雞", 鸣: "鳴", 鸥: "鷗", 鸦: "鴉", 鸭: "鴨", 鸯: "鴦",
  鸳: "鴛", 鸵: "鴕", 鸽: "鴿", 鸿: "鴻", 鹃: "鵑", 鹅: "鵝", 鹊: "鵲", 鹏: "鵬",
  鹤: "鶴", 鹦: "鸚", 鹫: "鷲", 鹭: "鷺", 鹰: "鷹", 麦: "麥", 黄: "黃", 齐: "齊",
  齿: "齒", 龄: "齡", 龙: "龍", 龚: "龔", 龟: "龜",
};

function toTraditional(value: string | null | undefined) {
  if (!value) {
    return value ?? "";
  }
  return [...value].map((char) => S2T[char] ?? char).join("");
}

export function stripSeriesFromTitle(title: string) {
  let next = title.trim();
  for (let i = 0; i < 4; i += 1) {
    const stripped = next.replace(SERIES_TITLE_PREFIX, "").trim();
    if (stripped === next) {
      break;
    }
    next = stripped;
  }
  return next;
}

export function mapleJournalTitle(trip: Pick<TripDetail, "id" | "title">) {
  const locked = VANITY_CREW_JOURNAL_TITLES[trip.id as keyof typeof VANITY_CREW_JOURNAL_TITLES];
  if (locked) {
    return locked;
  }
  return toTraditional(stripSeriesFromTitle(trip.title)).replace(/[（(]\s*Day\s*\d+\s*[）)]/gi, "").trim();
}

function convertJournalEntry(entry: JournalEntry, tripId: string, index: number): JournalEntry {
  return {
    ...entry,
    id: entry.id || `journal_${tripId}_${index + 1}`,
    tripId,
    title: toTraditional(entry.title),
    body: toTraditional(entry.body),
    mood: entry.mood ? toTraditional(entry.mood) : entry.mood,
    weatherSummary: entry.weatherSummary ? toTraditional(entry.weatherSummary) : entry.weatherSummary,
    aiSummary: entry.aiSummary ? toTraditional(entry.aiSummary) : entry.aiSummary,
  };
}

export function prepareMapleJournal(trip: TripDetail): TripDetail {
  const photos = (trip.photos as IngestPhoto[])
    .map((photo, index) => normalizePhoto(photo, trip.id, index))
    .filter((photo): photo is Photo => Boolean(photo))
    .map((photo) => ({
      ...photo,
      caption: photo.caption ? toTraditional(photo.caption) : photo.caption,
      originalFilename: photo.originalFilename,
    }));

  const draftNotes = "draftNotes" in trip && typeof (trip as { draftNotes?: unknown }).draftNotes === "string"
    ? toTraditional((trip as { draftNotes: string }).draftNotes)
    : undefined;

  return {
    ...trip,
    userId: trip.userId || "user_travelos_owner",
    title: mapleJournalTitle(trip),
    summary: toTraditional(trip.summary),
    visibility: "private",
    series: VANITY_CREW_SERIES,
    seriesAliases: [...VANITY_CREW_SERIES_ALIASES],
    coverPhotoId: trip.coverPhotoId || photos[0]?.id || null,
    photos,
    places: (trip.places ?? []).map((place, index) => {
      const next = normalizePlace(place, trip.id, index);
      return {
        ...next,
        name: toTraditional(next.name),
        notes: next.notes ? toTraditional(next.notes) : next.notes,
        address: next.address ? toTraditional(next.address) : next.address,
      };
    }),
    journalEntries: (trip.journalEntries ?? []).map((entry, index) => convertJournalEntry(entry, trip.id, index)),
    travelRoute: trip.travelRoute ?? [],
    costs: trip.costs ?? [],
    musicTracks: trip.musicTracks ?? [],
    ...(draftNotes !== undefined ? { draftNotes } : {}),
  };
}

export function prepareTripForWarehouse(trip: TripDetail) {
  return MAPLE_JOURNAL_ID_SET.has(trip.id) ? prepareMapleJournal(trip) : trip;
}

export function isHeldFamilyEditorTrip(tripId: string) {
  return HELD_TRIP_ID_SET.has(tripId);
}

export function tripSeriesNames(trip: Pick<TripDetail, "series" | "seriesAliases" | "title">) {
  return [trip.series, ...(trip.seriesAliases ?? []), trip.title].filter((value): value is string => Boolean(value));
}

export function searchTripsBySeries(trips: TripDetail[], query: string) {
  const needle = query.trim();
  if (!needle) {
    return trips;
  }
  return trips.filter((trip) => tripSeriesNames(trip).some((name) => name.includes(needle)));
}

export function prepareFamilyEditorTrips(trips: TripDetail[]): TripDetail[] {
  return trips
    .filter((trip) => !isHeldFamilyEditorTrip(trip.id))
    .map((trip) => (MAPLE_JOURNAL_ID_SET.has(trip.id) ? prepareMapleJournal(trip) : trip));
}
