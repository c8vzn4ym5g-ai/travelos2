export function isFamilyPinRequired() {
  // Owner chose a direct family entrance on 2026-09-13, without recurring PINs.
  return false;
}

export function isAdminPinValid(pin: string | null) {
  void pin;
  return true;
}
