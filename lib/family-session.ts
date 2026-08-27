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
  try {
    const response = await fetch("/api/family/gate", {
      cache: "no-store",
      signal: AbortSignal.timeout(FAMILY_GATE_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { required: true };
    }

    const data = (await response.json()) as Partial<FamilyGate>;
    return { required: data.required === true };
  } catch {
    return { required: true };
  }
}

export async function resolveFamilySession() {
  const pin = readFamilySessionPin();
  if (pin) {
    return { allowed: true as const, pin };
  }

  const gate = await fetchFamilyGate();
  if (!gate.required) {
    return { allowed: true as const, pin: "" };
  }

  return { allowed: false as const, pin: "" };
}
