import { headers } from "next/headers";
import {
  pathnameFromRequestHeaders,
  shouldLoadTravelpayoutsDrive,
  TRAVELPAYOUTS_DRIVE_SCRIPT_ID,
  travelpayoutsDriveScriptUrl,
} from "@/lib/travelpayouts-drive";

export async function TravelpayoutsDrive() {
  const headerStore = await headers();
  const pathname = pathnameFromRequestHeaders(headerStore);
  if (!shouldLoadTravelpayoutsDrive(pathname)) {
    return null;
  }

  const src = travelpayoutsDriveScriptUrl({
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
  });

  return (
    <script
      async
      data-cfasync="false"
      data-no-defer="1"
      data-noptimize="1"
      data-wpfc-render="false"
      id={TRAVELPAYOUTS_DRIVE_SCRIPT_ID}
      seraph-accel-crit="1"
      src={src}
    />
  );
}
