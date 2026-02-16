import { getAllProfiles, saveProfile } from './db.js';

const ACTIVE_PROFILE_KEY = 'sar_active_profile';

export async function bootstrapProfiles(seedProfiles) {
  const existing = await getAllProfiles();
  if (existing.length) return existing;
  for (const p of seedProfiles) {
    await saveProfile(p);
  }
  return seedProfiles;
}

export function getActiveProfileId() {
  return localStorage.getItem(ACTIVE_PROFILE_KEY);
}

export function setActiveProfileId(profileId) {
  localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
}
