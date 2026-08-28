#!/usr/bin/env node
import { rebuildDriveMomentIndex, resetMomentStoreForTests, setDriveWarehouseFetchForTests } from "../lib/moment-store.ts";
import { countUniqueDisplayJpegs, countUniqueDriveDisplayJpegs } from "../lib/drive-photo-index.ts";
import { scanWarehouseFiles } from "../lib/drive-warehouse.ts";

resetMomentStoreForTests();
setDriveWarehouseFetchForTests(null);

const rebuilt = await rebuildDriveMomentIndex();
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
    },
    null,
    2,
  ),
);
