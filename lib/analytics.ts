"use client";

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const POSTHOG_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || "phc_rH4P6CPgZ9FdCGRx3NdvL6G9NuLbfhG8HpubBgBM3nu4";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const STORAGE_KEY = "sportfolio:posthog-distinct-id";

function getDistinctId() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

export async function identifyTeacher(teacherUserId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, teacherUserId);
}

export async function trackProductEvent(event: string, properties?: AnalyticsProperties) {
  if (typeof window === "undefined" || !POSTHOG_TOKEN) return;
  const distinctId = getDistinctId();
  if (!distinctId) return;

  const cleanProperties = Object.fromEntries(
    Object.entries(properties ?? {}).filter(([, value]) => value !== undefined)
  );

  try {
    await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        api_key: POSTHOG_TOKEN,
        event,
        properties: {
          distinct_id: distinctId,
          $process_person_profile: true,
          app: "sportfolio",
          ...cleanProperties,
        },
      }),
    });
  } catch {
    // Analytics must never interrupt teaching or evidence capture.
  }
}

export async function resetAnalytics() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
