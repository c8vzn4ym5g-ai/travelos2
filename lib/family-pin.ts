export function isFamilyPinRequired() {
  return process.env.TRAVELOS_REQUIRE_FAMILY_PIN === "1";
}

export function isAdminPinValid(pin: string | null) {
  if (!isFamilyPinRequired()) {
    return true;
  }

  const expectedPin = process.env.TRAVELOS_ADMIN_PIN;
  return Boolean(expectedPin && pin && pin === expectedPin);
}
