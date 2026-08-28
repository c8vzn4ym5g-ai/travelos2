const JPEG_SOI = 0xd8;
const JPEG_EOI = 0xd9;
const JPEG_SOS = 0xda;
const JPEG_APP1 = 0xe1;
const TIFF_IFD1_JPEG_OFFSET = 0x0201;
const TIFF_IFD1_JPEG_LENGTH = 0x0202;
const MAX_EXIF_THUMB_BYTES = 180_000;

function readU16(bytes: Uint8Array, offset: number, littleEndian: boolean) {
  if (offset + 2 > bytes.length) {
    return null;
  }
  return littleEndian ? bytes[offset] | (bytes[offset + 1] << 8) : (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32(bytes: Uint8Array, offset: number, littleEndian: boolean) {
  if (offset + 4 > bytes.length) {
    return null;
  }
  if (littleEndian) {
    return (
      (bytes[offset] + bytes[offset + 1] * 0x100 + bytes[offset + 2] * 0x10000 + bytes[offset + 3] * 0x1000000) >>> 0
    );
  }
  return (
    (bytes[offset] * 0x1000000 + bytes[offset + 1] * 0x10000 + bytes[offset + 2] * 0x100 + bytes[offset + 3]) >>> 0
  );
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === JPEG_SOI;
}

function readTiffIfd1Thumb(tiff: Uint8Array): Uint8Array | null {
  if (tiff.length < 8) {
    return null;
  }
  const littleEndian = tiff[0] === 0x49 && tiff[1] === 0x49;
  const bigEndian = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!littleEndian && !bigEndian) {
    return null;
  }
  const magic = readU16(tiff, 2, littleEndian);
  if (magic !== 42) {
    return null;
  }
  const ifd0 = readU32(tiff, 4, littleEndian);
  if (ifd0 == null || ifd0 + 2 > tiff.length) {
    return null;
  }
  const ifd0Count = readU16(tiff, ifd0, littleEndian);
  if (ifd0Count == null) {
    return null;
  }
  const ifd1OffsetAt = ifd0 + 2 + ifd0Count * 12;
  const ifd1 = readU32(tiff, ifd1OffsetAt, littleEndian);
  if (!ifd1 || ifd1 + 2 > tiff.length) {
    return null;
  }
  const ifd1Count = readU16(tiff, ifd1, littleEndian);
  if (ifd1Count == null) {
    return null;
  }

  let jpegOffset: number | null = null;
  let jpegLength: number | null = null;
  for (let index = 0; index < ifd1Count; index += 1) {
    const entry = ifd1 + 2 + index * 12;
    const tag = readU16(tiff, entry, littleEndian);
    const value = readU32(tiff, entry + 8, littleEndian);
    if (tag === TIFF_IFD1_JPEG_OFFSET) {
      jpegOffset = value;
    }
    if (tag === TIFF_IFD1_JPEG_LENGTH) {
      jpegLength = value;
    }
  }
  if (!jpegOffset || !jpegLength || jpegLength > MAX_EXIF_THUMB_BYTES) {
    return null;
  }
  if (jpegOffset + jpegLength > tiff.length) {
    return null;
  }
  const thumb = tiff.subarray(jpegOffset, jpegOffset + jpegLength);
  return isJpeg(thumb) ? thumb : null;
}

export function extractExifJpegThumbnail(bytes: Uint8Array): Uint8Array | null {
  if (!isJpeg(bytes)) {
    return null;
  }

  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === JPEG_SOI || marker === JPEG_EOI) {
      offset += 2;
      continue;
    }
    if (marker === JPEG_SOS) {
      break;
    }
    const size = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (size < 2 || offset + 2 + size > bytes.length) {
      break;
    }
    const payload = bytes.subarray(offset + 4, offset + 2 + size);
    if (
      marker === JPEG_APP1 &&
      payload.length > 12 &&
      payload[0] === 0x45 &&
      payload[1] === 0x78 &&
      payload[2] === 0x69 &&
      payload[3] === 0x66 &&
      payload[4] === 0x00 &&
      payload[5] === 0x00
    ) {
      const thumb = readTiffIfd1Thumb(payload.subarray(6));
      if (thumb) {
        return new Uint8Array(thumb);
      }
    }
    offset += 2 + size;
  }

  return null;
}

export function isJpegBytes(bytes: Uint8Array) {
  return isJpeg(bytes);
}
