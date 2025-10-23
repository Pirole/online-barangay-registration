// src/utils/eventMapper.ts
import type { BackendEvent } from "../context/EventContext";
import type { FrontendEvent } from "../components/events/EventCard";

// 🔧 Automatically detect backend base URL
// In production, your frontend and backend may share the same domain.
// Fallback to localhost for local development.
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export function mapEvent(be: BackendEvent): FrontendEvent {
  let startDate: Date | null = null;

  // ✅ Safely parse start_date
  if (be.start_date) {
    const parsed = new Date(be.start_date);
    if (!isNaN(parsed.getTime())) {
      startDate = parsed;
    }
  }

  // ✅ Return mapped event for frontend use
  return {
    id: be.id,
    title: be.title,
    description: be.description || "",
    date: startDate ? startDate.toISOString().split("T")[0] : "TBA",
    time: startDate
      ? startDate.toLocaleTimeString("en-PH", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "",
    location: be.location,
    capacity: be.capacity ?? 0,
    registeredCount: be.registrant_count ?? 0,
    category: "other", // until backend adds categories
    status: be.status ?? "upcoming",
    imageUrl: be.photo_path
      ? `${API_BASE}${be.photo_path}` // ✅ real uploaded photo
      : "/placeholder.png", // fallback
  };
}
