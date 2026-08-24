export function AffiliateDisclosure({ className = "" }: { className?: string }) {
  return (
    <aside className={className} data-affiliate-disclosure="">
      <h2 className="font-semibold">聯盟連結揭露 / Affiliate disclosure</h2>
      <p className="mt-2">
        部分連結可能是聯盟連結；價格不會因此增加。TravelOS 使用 Travelpayouts Drive 協助辨識適合的航班、住宿與活動連結。若讀者完成合資格預訂，TravelOS 可能獲得收益。
      </p>
      <p className="mt-2">
        Some links may be affiliate links. The price does not increase. TravelOS uses Travelpayouts Drive to recognize useful flight, stay, and activity links. Qualifying bookings may earn TravelOS a commission.
      </p>
      <p className="mt-2">
        Drive 不是租車搜尋器；它是讀取公開旅遊內容的智慧聯盟連結層。 / Drive is not a car-rental search. It is an affiliate layer over public travel copy.
      </p>
    </aside>
  );
}
