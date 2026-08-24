export function AffiliateDisclosure({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-5 text-zinc-500 ${className}`.trim()} data-affiliate-disclosure="">
      部分連結可能是聯盟連結；價格不會因此增加。 / Some links may be affiliate. The price does not increase.
    </p>
  );
}
