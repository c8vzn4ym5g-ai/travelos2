#!/usr/bin/env node
import { rebuildDriveMomentIndex, resetMomentStoreForTests, setDriveWarehouseFetchForTests } from "../lib/moment-store.ts";
import { countUniqueDisplayJpegs, countUniqueDriveDisplayJpegs } from "../lib/drive-photo-index.ts";
import { scanWarehouseFiles } from "../lib/drive-warehouse.ts";

resetMomentStoreForTests();
setDriveWarehouseFetchForTests(null);

const momentId = process.argv.slice(2).find((arg) => arg.startsWith("moment_")) ?? "";
const rebuilt = await rebuildDriveMomentIndex(momentId ? { momentId } : {});
let driveDisplay = 0;
try {
  driveDisplay = countUniqueDriveDisplayJpegs(await scanWarehouseFiles());
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
}

console.log(
  JSON.stringify(
    {
      displayJpegCount: rebuilt.displayJpegCount,
      driveDisplayJpegCount: driveDisplay,
      fileCount: rebuilt.fileCount,
      momentCount: rebuilt.momentCount,
      rebuilt: rebuilt.rebuilt,
      indexDisplayJpegCount: countUniqueDisplayJpegs(rebuilt.content.moments),
      ...(momentId
        ? {
            momentId,
            photoCount: rebuilt.content.moments.find((moment) => moment.id === momentId)?.photos.length ?? 0,
          }
        : {}),
    },
    null,
    2,
  ),
);
