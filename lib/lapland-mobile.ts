export const LAPLAND_MOBILE_MAX_WIDTH_PX = 639;

const PHONE_UA = /iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i;
const TABLET_UA = /iPad|Tablet|PlayBook|Nexus 7|Nexus 10|SM-T/i;

export function isLaplandPhoneUserAgent(userAgent: string) {
  if (TABLET_UA.test(userAgent)) {
    return false;
  }

  return PHONE_UA.test(userAgent);
}
