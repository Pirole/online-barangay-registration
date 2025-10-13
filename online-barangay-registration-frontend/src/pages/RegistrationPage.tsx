// src/context/EventContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { mapEvent } from "../utils/eventMapper";
import type { FrontendEvent } from "../components/events/EventCard";

const API_BASE = "http://localhost:5000/api/v1";

/* =====================
   Interfaces
   ===================== */
export interface CustomField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox" | "textarea";
  required: boolean;
  validation?: string;
  options?: string[];
}

export interface BackendEvent {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  capacity: number;
  age_min?: number;
  age_max?: number;
  custom_fields: CustomField[];
  manager_id: string;
  allow_autocheckin: boolean;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
  registration_count?: number;
}

export interface Registrant {
  id: string;
  event_id: string;
  name: string;
  address: string;
  age: number;
  phone: string;
  barangay: string;
  photo_path?: string;
  custom_field_values: Record<string, any>;
  status: "pending" | "approved" | "rejected" | "flagged";
  qr_value?: string;
  qr_image_path?: string;
  created_at: string;
  rejection_reason?: string;
}

/* =====================
   Context Type
   ===================== */
interface EventContextType {
  events: FrontendEvent[];
  selectedEvent: FrontendEvent | null;
  registrants: Registrant[];
  isLoading: boolean;
  error: string | null;

  fetchEvents(params?: { status?: string; search?: string; page?: number; limit?: number }): Promise<void>;
  fetchEventById(id: string): Promise<FrontendEvent | null>;
  createEvent(eventData: Partial<FrontendEvent>): Promise<FrontendEvent>;
  updateEvent(id: string, eventData: Partial<FrontendEvent>): Promise<FrontendEvent>;
  deleteEvent(id: string): Promise<void>;

  fetchRegistrants(eventId: string, params?: { status?: string }): Promise<void>;
  registerForEvent(eventId: string, registrationData: any): Promise<{ registrationId: string }>;
  approveRegistrant(registrationId: string): Promise<void>;
  rejectRegistrant(registrationId: string, reason: string): Promise<void>;

  clearError(): void;
  setSelectedEvent(event: FrontendEvent | null): void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

/* =====================
   Helper Functions
   ===================== */
const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with ${res.status}`);
  }
  return res.json();
};

const getAuthHeaders = (isJson = true) => {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("auth_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (isJson) headers["Content-Type"] = "application/json";
  return headers;
};

/* =====================
   Provider
   ===================== */
export const EventProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<FrontendEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<FrontendEvent | null>(null);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /* ---------- EVENTS ---------- */
  const fetchEvents = useCallback(async (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (params?.status) query.append("status", params.status);
      if (params?.search) query.append("search", params.search);
      if (params?.page) query.append("page", String(params.page));
      if (params?.limit) query.append("limit", String(params.limit));

      const res = await fetch(`${API_BASE}/events?${query}`);
      const json = await handleResponse(res);
      setEvents((json.data || []).map(mapEvent));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch events");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchEventById = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/events/${id}`);
      const json = await handleResponse(res);
      const event = mapEvent(json.data);
      setSelectedEvent(event);
      return event;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch event");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createEvent = useCallback(async (data: Partial<FrontendEvent>) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/events`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      const json = await handleResponse(res);
      const newEvent = mapEvent(json.data);
      setEvents((prev) => [...prev, newEvent]);
      return newEvent;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create event";
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateEvent = useCallback(async (id: string, data: Partial<FrontendEvent>) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/events/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      const json = await handleResponse(res);
      const updated = mapEvent(json.data);
      setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
      if (selectedEvent?.id === id) setSelectedEvent(updated);
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update event";
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEvent]);

  const deleteEvent = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/events/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(false),
      });
      await handleResponse(res);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      if (selectedEvent?.id === id) setSelectedEvent(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete event";
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEvent]);

  /* ---------- REGISTRANTS ---------- */
  const fetchRegistrants = useCallback(async (eventId: string, params?: { status?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (params?.status) query.append("status", params.status);
      const res = await fetch(`${API_BASE}/events/${eventId}/registrants?${query}`, {
        headers: getAuthHeaders(false),
      });
      const json = await handleResponse(res);
      setRegistrants(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch registrants");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const registerForEvent = useCallback(async (eventId: string, formData: any): Promise<{ registrationId: string }> => {
    setIsLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("eventId", eventId);
      fd.append("customValues", JSON.stringify({
        firstName: formData.firstName,
        lastName: formData.lastName,
        age: formData.age,
        address: formData.address,
        barangay: formData.barangay,
        phone: formData.phone,
      }));

      if (formData.photo) {
        const byteString = atob(formData.photo.split(",")[1]);
        const mimeString = formData.photo.split(",")[0].split(":")[1].split(";")[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: mimeString });
        fd.append("photo", blob, "photo.jpg");
      }

      const res = await fetch(`${API_BASE}/registrations`, { method: "POST", body: fd });
      const json = await handleResponse(res);
      return json.data as { registrationId: string };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const approveRegistrant = useCallback(async (registrationId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/registrants/${registrationId}/approve`, {
        method: "POST",
        headers: getAuthHeaders(false),
      });
      await handleResponse(res);
      setRegistrants((prev) =>
        prev.map((r) => (r.id === registrationId ? { ...r, status: "approved" } : r))
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const rejectRegistrant = useCallback(async (registrationId: string, reason: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/registrants/${registrationId}/reject`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason }),
      });
      await handleResponse(res);
      setRegistrants((prev) =>
        prev.map((r) =>
          r.id === registrationId ? { ...r, status: "rejected", rejection_reason: reason } : r
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ---------- INITIAL FETCH ---------- */
  useEffect(() => {
    fetchEvents({ status: "upcoming" });
  }, [fetchEvents]);

  const value: EventContextType = {
    events,
    selectedEvent,
    registrants,
    isLoading,
    error,
    fetchEvents,
    fetchEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    fetchRegistrants,
    registerForEvent,
    approveRegistrant,
    rejectRegistrant,
    clearError,
    setSelectedEvent,
  };

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
};

/* =====================
   Hook
   ===================== */
export const useEvents = (): EventContextType => {
  const context = useContext(EventContext);
  if (!context) throw new Error("useEvents must be used within an EventProvider");
  return context;
};
