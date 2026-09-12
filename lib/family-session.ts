export const FAMILY_ADMIN_SESSION_KEY = "travelos-admin-pin";
export const FAMILY_GATE_TIMEOUT_MS = 4000;

export type FamilyGate = {
  required: boolean;
};

export function familyPinHeaders(pin: string): Record<string, string> {
  return { "x-travelos-admin-pin": pin };
}

export function readFamilySessionPin() {
  return window.sessionStorage.getItem(FAMILY_ADMIN_SESSION_KEY) ?? "";
}

export async function fetchFamilyGate(): Promise<FamilyGate> {
  return { required: false };
}

export async function resolveFamilySession() {
  return { allowed: true as const, pin: "" };
}