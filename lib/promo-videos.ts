export type PromoVideo = {
  title: string;
  caption: string;
  src: string;
  mood: string;
};

const promoByTripSlug: Record<string, PromoVideo[]> = {
  "scotland-edinburgh-whisky-2019": [
    { title: "蘇格蘭冬日・老城版", caption: "石牆、冷風與愛丁堡老城。", src: "/travelos/promo/scotland-a.mp4", mood: "慢板冬季" },
    { title: "蘇格蘭冬日・威士忌版", caption: "從老城走進琥珀色酒鄉。", src: "/travelos/promo/scotland-b.mp4", mood: "慢板暖色" },
  ],
  "kyushu-family-fukuoka-oguni-aso-2026": [
    { title: "九州家庭慢遊・路線版", caption: "福岡、小國町與阿蘇。", src: "/travelos/promo/kyushu-a.mp4", mood: "初秋輕快" },
    { title: "九州家庭慢遊・生活版", caption: "把食物與生活細節放進旅程。", src: "/travelos/promo/kyushu-b.mp4", mood: "明亮溫暖" },
  ],
  "tainan-yanshui-beehive-fireworks-2020": [
    { title: "鹽水蜂炮・進場版", caption: "從準備走進火光。", src: "/travelos/promo/tainan-a.mp4", mood: "節慶強拍" },
    { title: "鹽水蜂炮・現場版", caption: "煙霧、震動與民俗現場。", src: "/travelos/promo/tainan-b.mp4", mood: "節慶強拍" },
  ],
  "paris-to-rhine-2013": [
    { title: "巴黎到萊茵河・城市版", caption: "從凱旋門走向木構小鎮。", src: "/travelos/promo/paris-rhine-a.mp4", mood: "初秋中板" },
    { title: "巴黎到萊茵河・河岸版", caption: "古堡與河岸收住跨國旅程。", src: "/travelos/promo/paris-rhine-b.mp4", mood: "初秋舒緩" },
  ],
  "paris-louvre-summer-2023": [
    { title: "巴黎盛夏・傘街版", caption: "彩色傘街的明亮開場。", src: "/travelos/promo/paris-2023-a.mp4", mood: "夏日輕快" },
    { title: "巴黎盛夏・羅浮宮版", caption: "從日常走進藝術。", src: "/travelos/promo/paris-2023-b.mp4", mood: "城市律動" },
  ],
  "croatia-to-venice-2011": [
    { title: "亞得里亞海・出發版", caption: "克羅埃西亞段到威尼斯。", src: "/travelos/promo/croatia-venice-a.mp4", mood: "春日中板" },
    { title: "亞得里亞海・水城版", caption: "船行過水城，行程跟著換速。", src: "/travelos/promo/croatia-venice-b.mp4", mood: "地中海明亮" },
  ],
};

export const coffeePromoVideos: PromoVideo[] = [
  { title: "咖啡途中・杯子版", caption: "一只杯子，也是一段記憶。", src: "/travelos/promo/coffee-a.mp4", mood: "午後舒緩" },
  { title: "咖啡途中・空間版", caption: "先留下停下來的感覺。", src: "/travelos/promo/coffee-b.mp4", mood: "木質暖調" },
];

export function getTripPromoVideos(slug: string) {
  return (promoByTripSlug[slug] ?? []).map(video => ({ ...video, src: `/api/trips/media?name=travelos__promo__${video.src.split("/").pop()}` }));
}
