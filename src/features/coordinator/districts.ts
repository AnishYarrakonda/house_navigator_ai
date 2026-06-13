// Approx centroids for the SF districts the Foresight agent names in its
// alerts, so the coordinator's "pre-position" action can drop a marker on the
// rising bloom. These are coarse public district centers — never a person's
// point. Unknown areas fall back to the SF center.

import { SF_CENTER } from "../../config";

const DISTRICTS: Record<string, { lat: number; lng: number }> = {
  tenderloin: { lat: 37.7836, lng: -122.4146 },
  mission: { lat: 37.7599, lng: -122.4148 },
  soma: { lat: 37.7785, lng: -122.4056 },
  bayview: { lat: 37.7299, lng: -122.3892 },
  "civic center": { lat: 37.7796, lng: -122.4156 },
  haight: { lat: 37.7702, lng: -122.4469 },
};

export function districtCenter(area: string): { lat: number; lng: number } {
  return DISTRICTS[area.trim().toLowerCase()] ?? SF_CENTER;
}
