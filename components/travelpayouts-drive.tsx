import { headers } from "next/headers";
import { isPublicDrivePath, TRAVELPAYOUTS_DRIVE_SCRIPT_URL } from "@/lib/travelpayouts";

export async function TravelpayoutsDrive() {
  const headerList = await headers();
  const pathname = headerList.get("x-travelos-pathname") ?? "";

  if (!pathname || !isPublicDrivePath(pathname)) {
    return null;
  }

  return (
    <script
      async
      data-cfasync="false"
      data-no-defer="1"
      data-noptimize="1"
      data-wpfc-render="false"
      id="travelpayouts-drive"
      seraph-accel-crit="1"
      src={TRAVELPAYOUTS_DRIVE_SCRIPT_URL}
    />
  );
}
