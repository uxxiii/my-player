export type GoogleCredentialPayload = {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
};

export const parseGoogleCredential = (credential: string | null | undefined): GoogleCredentialPayload | null => {
  if (!credential) return null;

  try {
    const payload = credential.split('.')[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as GoogleCredentialPayload;
  } catch {
    return null;
  }
};