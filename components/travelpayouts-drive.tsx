import Script from "next/script";

const driveScriptUrl = "https://emrldtp.cc/NTUwMzEz.js?t=550313";

export function TravelpayoutsDrive() {
  return (
    <Script
      data-cfasync="false"
      data-no-defer="1"
      data-noptimize="1"
      data-wpfc-render="false"
      id="travelpayouts-drive"
      seraph-accel-crit="1"
      src={driveScriptUrl}
      strategy="afterInteractive"
    />
  );
}
