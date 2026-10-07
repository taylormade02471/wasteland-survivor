import {
  controlsTourStorageIdentity,
  controlsTourStorageKey,
  mergeSeenControlsFamilies,
} from "./controls-tour.mjs";

export function captureControlsTourPreferenceIdentity({ profile = null, guest = false } = {}) {
  const capturedGuest = Boolean(guest);
  const profileRef = capturedGuest ? null : profile;
  const identityInput = { profile: profileRef, guest: capturedGuest };
  return Object.freeze({
    identity: controlsTourStorageIdentity(identityInput),
    storageKey: controlsTourStorageKey(identityInput),
    profileRef,
    guest: capturedGuest,
    backendSession: capturedGuest ? "" : String(profileRef?.backendSession || ""),
  });
}

export function isControlsTourPreferenceIdentityCurrent(capture, identityInput = {}) {
  if (!capture) return false;
  const current = captureControlsTourPreferenceIdentity(identityInput);
  return capture.identity === current.identity
    && capture.storageKey === current.storageKey
    && capture.profileRef === current.profileRef
    && capture.guest === current.guest;
}

export async function syncControlsTourPreferencesForIdentity({
  identityInput = {},
  getCurrentIdentityInput = () => identityInput,
  localFamilies = [],
  requestFamilies,
  readCurrentFamilies = () => [],
  applyFamilies,
} = {}) {
  const capture = captureControlsTourPreferenceIdentity(identityInput);
  const baseline = mergeSeenControlsFamilies(localFamilies);
  const remoteFamilies = await requestFamilies(capture);
  if (!isControlsTourPreferenceIdentityCurrent(capture, getCurrentIdentityInput())) {
    return Object.freeze({ status: "stale", families: baseline });
  }
  const merged = mergeSeenControlsFamilies(baseline, readCurrentFamilies(capture), remoteFamilies);
  const saved = applyFamilies({ capture, families: merged });
  return Object.freeze({ status: "applied", families: mergeSeenControlsFamilies(saved) });
}

export function applyRequiredControlsTourLock({ required = false, bodyClassList, backgroundTargets = [] } = {}) {
  const locked = Boolean(required);
  bodyClassList?.toggle("controls-tour-required", locked);
  for (const target of backgroundTargets) {
    if (target) target.inert = locked;
  }
  return locked;
}
