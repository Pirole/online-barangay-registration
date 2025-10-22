// src/utils/eventMapper.ts
import type { BackendEvent } from "../context/EventContext";
import type { FrontendEvent } from "../components/events/EventCard";

const API_BASE = "http://localhost:5000"; // adjust if your backend runs elsewhere

export function mapEvent(be: BackendEvent): FrontendEvent {
  // --- Safely parse start date ---
  let startDate: Date | null = null;
  if (be.start_date) {
    const parsed = new Date(be.start_date);
    if (!isNaN(parsed.getTime())) startDate = parsed;
  }

  // --- Handle image URL ---
  // Prefer a backend-provided photo path (photo_path, image, or similar)
  let imageUrl = "/placeholder.png";
  if ((be as any).photo_path || (be as any).image || (be as any).banner) {
    const rawPath =
      (be as any).photo_path ||
      (be as any).image ||
      (be as any).banner ||
      "";
    // If path doesn’t already start with http, prefix with backend base
    imageUrl = rawPath.startsWith("http")
      ? rawPath
      : `${API_BASE}/${rawPath.replace(/^\/+/, "")}`;
  }

  // --- Normalize registration count ---
  const registeredCount =
    be.registration_count ??
    (be as any).registrant_count ??
    (be as any).registrants_count ??
    0;

  // --- Format date and time ---
  const date = startDate
    ? startDate.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "TBA";

  const time = startDate
    ? startDate.toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  // --- Return normalized FrontendEvent ---
  return {
    id: be.id,
    title: be.title,
    description: be.description || "",
    date,
    time,
    location: be.location,
    capacity: be.capacity ?? 0,
    registeredCount,
    category: (be as any).category || "other",
    status: be.status ?? "upcoming",
    imageUrl,
  };
}
  