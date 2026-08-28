import assert from "node:assert/strict";
import test from "node:test";
import { extractExifJpegThumbnail, isJpegBytes } from "../lib/jpeg-exif-thumb.ts";

function jpegWithExifThumbnail(thumb: Uint8Array) {
  const jpegAt = 44;
  const tiff = Buffer.alloc(jpegAt + thumb.length);
  tiff[0] = 0x4d;
  tiff[1] = 0x4d;
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(0, 8);
  tiff.writeUInt32BE(14, 10);
  tiff.writeUInt16BE(2, 14);
  tiff.writeUInt16BE(0x0201, 16);
  tiff.writeUInt16BE(4, 18);
  tiff.writeUInt32BE(1, 20);
  tiff.writeUInt32BE(jpegAt, 24);
  tiff.writeUInt16BE(0x0202, 28);
  tiff.writeUInt16BE(4, 30);
  tiff.writeUInt32BE(1, 32);
  tiff.writeUInt32BE(thumb.length, 36);
  tiff.writeUInt32BE(0, 40);
  Buffer.from(thumb).copy(tiff, jpegAt);

  const app1Payload = Buffer.concat([Buffer.from("Exif\0\0"), tiff]);
  const app1Length = app1Payload.length + 2;
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1, (app1Length >> 8) & 0xff, app1Length & 0xff]),
    app1Payload,
    Buffer.from([0xff, 0xd9]),
  ]);
}

test("extractExifJpegThumbnail reads the IFD1 JPEG from APP1 Exif", () => {
  const nested = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 0xde, 0xad, 0xbe, 0xef]);
  const jpeg = jpegWithExifThumbnail(nested);
  assert.equal(isJpegBytes(jpeg), true);
  assert.deepEqual([...extractExifJpegThumbnail(jpeg)!], [...nested]);
});

test("extractExifJpegThumbnail returns null when there is no Exif thumb", () => {
  const plain = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  assert.equal(extractExifJpegThumbnail(plain), null);
  assert.equal(extractExifJpegThumbnail(Uint8Array.from([0x00, 0x01, 0x02, 0x03])), null);
});
