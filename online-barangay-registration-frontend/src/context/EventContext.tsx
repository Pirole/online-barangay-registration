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
  registrant_count?: number;
  photo_path?: string;
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

  fetchEvents: (
    params?: { status?: string; search?: string; page?: number; limit?: number }
  ) => Promise<void>;
  fetchEventById: (id: string) => Promise<FrontendEvent | null>;
  createEvent: (eventData: Partial<FrontendEvent>) => Promise<FrontendEvent>;
  updateEvent: (
    id: string,
    eventData: Partial<FrontendEvent>
  ) => Promise<FrontendEvent>;
  deleteEvent: (id: string) => Promise<void>;

  fetchRegistrants: (
    eventId: string,
    params?: { status?: string }
  ) => Promise<void>;
  registerForEvent: (
  eventId: string,
  registrationData: any
) => Promise<{ registrationId: string }>;
  approveRegistrant: (registrationId: string) => Promise<void>;
  rejectRegistrant: (registrationId: string, reason: string) => Promise<void>;

  clearError: () => void;
  setSelectedEvent: (event: FrontendEvent | null) => void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

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
  const fetchEvents = useCallback(
    async (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (params?.status) queryParams.append("status", params.status);
        if (params?.search) queryParams.append("search", params.search);
        if (params?.page) queryParams.append("page", params.page.toString());
        if (params?.limit) queryParams.append("limit", params.limit.toString());

        const response = await fetch(`${API_BASE}/events?${queryParams}`);
        if (!response.ok) throw new Error("Failed to fetch events");

        const data = await response.json();
        setEvents((data.data || []).map(mapEvent));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch events");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const fetchEventById = useCallback(async (id: string): Promise<FrontendEvent | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/events/${id}`);
      if (!response.ok) throw new Error("Failed to fetch event");
      const data = await response.json();
      const event = mapEvent(data.data);
      setSelectedEvent(event);
      return event;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch event");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createEvent = useCallback(async (eventData: Partial<FrontendEvent>): Promise<FrontendEvent> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(eventData),
      });
      if (!response.ok) throw new Error("Failed to create event");
      const data = await response.json();
      const newEvent = mapEvent(data.data);
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

  const updateEvent = useCallback(async (id: string, eventData: Partial<FrontendEvent>): Promise<FrontendEvent> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/events/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(eventData),
      });
      if (!response.ok) throw new Error("Failed to update event");
      const data = await response.json();
      const updatedEvent = mapEvent(data.data);
      setEvents((prev) => prev.map((e) => (e.id === id ? updatedEvent : e)));
      if (selectedEvent?.id === id) setSelectedEvent(updatedEvent);
      return updatedEvent;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update event";
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedEvent]);

  const deleteEvent = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/events/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to delete event");
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
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append("status", params.status);
      const response = await fetch(`${API_BASE}/events/${eventId}/registrants?${queryParams}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!response.ok) throw new Error("Failed to fetch registrants");
      const data = await response.json();
      setRegistrants(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch registrants");
    } finally {
      setIsLoading(false);
    }
  }, []);

const registerForEvent = useCallback(async (
  eventId: string,
  formData: any
): Promise<{ registrationId: string }> => {
  const fd = new FormData();
  fd.append("eventId", eventId);
  fd.append(
    "customValues",
    JSON.stringify({
      firstName: formData.firstName,
      lastName: formData.lastName,
      age: formData.age,
      address: formData.address,
      barangay: formData.barangay,
      phone: formData.phone,
    })
  );

  if (formData.photo) {
    const byteString = atob(formData.photo.split(",")[1]);
    const mimeString = formData.photo.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: mimeString });
    fd.append("photo", blob, "photo.jpg");
  }

  const response = await fetch(`${API_BASE}/registrations`, { method: "POST", body: fd });
  if (!response.ok) throw new Error("Registration failed");
  const data = await response.json();
  return data.data as { registrationId: string };
}, []);


  const approveRegistrant = useCallback(async (registrationId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/registrants/${registrationId}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!response.ok) throw new Error("Failed to approve registrant");
      setRegistrants((prev) =>
        prev.map((r) => (r.id === registrationId ? { ...r, status: "approved" } : r))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to approve registrant";
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const rejectRegistrant = useCallback(async (registrationId: string, reason: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/registrants/${registrationId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error("Failed to reject registrant");
      setRegistrants((prev) =>
        prev.map((r) =>
          r.id === registrationId ? { ...r, status: "rejected", rejection_reason: reason } : r
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reject registrant";
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ---------- AUTO FETCH ---------- */
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
