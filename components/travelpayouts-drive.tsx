import { headers } from "next/headers";
import {
  pathnameFromRequestHeaders,
  shouldLoadTravelpayoutsDrive,
  TRAVELPAYOUTS_DRIVE_SCRIPT_ID,
  TRAVELPAYOUTS_DRIVE_SCRIPT_URL,
} from "@/lib/travelpayouts-drive";

export async function TravelpayoutsDrive() {
  const pathname = pathnameFromRequestHeaders(await headers());
  if (!shouldLoadTravelpayoutsDrive(pathname)) {
    return null;
  }

  return (
    <script
      async
      data-cfasync="false"
      data-no-defer="1"
      data-noptimize="1"
      data-wpfc-render="false"
      id={TRAVELPAYOUTS_DRIVE_SCRIPT_ID}
      seraph-accel-crit="1"
      src={TRAVELPAYOUTS_DRIVE_SCRIPT_URL}
    />
  );
}
