"use client";

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

type PostHogClient = {
  capture: (event: string, properties?: AnalyticsProperties) => void;
  identify: (distinctId: string) => void;
  reset: () => void;
};

let posthogPromise: Promise<PostHogClient | null> | null = null;

async function client(): Promise<PostHogClient | null> {
  if (typeof window === "undefined") return null;
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) return null;

  if (!posthogPromise) {
    posthogPromise = import("posthog-js")
      .then(({ default: posthog }) => {
        if (!posthog.__loaded) {
          posthog.init(token, {
            api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
            defaults: "2026-05-30",
            autocapture: false,
            capture_pageview: false,
            capture_pageleave: false,
            disable_session_recording: true,
            person_profiles: "identified_only",
          });
        }
        return posthog as PostHogClient;
      })
      .catch(() => null);
  }

  return posthogPromise;
}

export async function identifyTeacher(teacherUserId: string) {
  const posthog = await client();
  posthog?.identify(teacherUserId);
}

export async function trackProductEvent(event: string, properties?: AnalyticsProperties) {
  const posthog = await client();
  posthog?.capture(event, properties);
}

export async function resetAnalytics() {
  const posthog = await client();
  posthog?.reset();
}
