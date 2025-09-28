// src/context/EventContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'textarea';
  required: boolean;
  validation?: string; // regex pattern
  options?: string[]; // for select type
}

export interface Event {
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
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
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
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  qr_value?: string;
  qr_image_path?: string;
  created_at: string;
  rejection_reason?: string;
}

interface EventContextType {
  events: Event[];
  selectedEvent: Event | null;
  registrants: Registrant[];
  isLoading: boolean;
  error: string | null;
  // Event methods
  fetchEvents: (params?: { status?: string; search?: string; page?: number; limit?: number }) => Promise<void>;
  fetchEventById: (id: string) => Promise<Event | null>;
  createEvent: (eventData: Partial<Event>) => Promise<Event>;
  updateEvent: (id: string, eventData: Partial<Event>) => Promise<Event>;
  deleteEvent: (id: string) => Promise<void>;
  // Registrant methods
  fetchRegistrants: (eventId: string, params?: { status?: string }) => Promise<void>;
  registerForEvent: (eventId: string, registrationData: any) => Promise<Registrant>;
  approveRegistrant: (registrantId: string) => Promise<void>;
  rejectRegistrant: (registrantId: string, reason: string) => Promise<void>;
  // Utility methods
  clearError: () => void;
  setSelectedEvent: (event: Event | null) => void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

interface EventProviderProps {
  children: ReactNode;
}

export const EventProvider: React.FC<EventProviderProps> = ({ children }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const fetchEvents = async (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.search) queryParams.append('search', params.search);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());

      const response = await fetch(`/api/events?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch events');

      const data = await response.json();
      setEvents(data.events || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEventById = async (id: string): Promise<Event | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${id}`);
      if (!response.ok) throw new Error('Failed to fetch event');

      const event = await response.json();
      setSelectedEvent(event);
      return event;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch event');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const createEvent = async (eventData: Partial<Event>): Promise<Event> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) throw new Error('Failed to create event');

      const newEvent = await response.json();
      setEvents(prev => [...prev, newEvent]);
      return newEvent;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create event';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateEvent = async (id: string, eventData: Partial<Event>): Promise<Event> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) throw new Error('Failed to update event');

      const updatedEvent = await response.json();
      setEvents(prev => prev.map(event => event.id === id ? updatedEvent : event));
      if (selectedEvent?.id === id) setSelectedEvent(updatedEvent);
      return updatedEvent;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update event';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteEvent = async (id: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete event');

      setEvents(prev => prev.filter(event => event.id !== id));
      if (selectedEvent?.id === id) setSelectedEvent(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete event';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRegistrants = async (eventId: string, params?: { status?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);

      const response = await fetch(`/api/events/${eventId}/registrants?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch registrants');

      const data = await response.json();
      setRegistrants(data.registrants || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch registrants');
    } finally {
      setIsLoading(false);
    }
  };

  const registerForEvent = async (eventId: string, registrationData: any): Promise<Registrant> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      const registrant = await response.json();
      return registrant;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const approveRegistrant = async (registrantId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/registrants/${registrantId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to approve registrant');

      setRegistrants(prev => prev.map(r => 
        r.id === registrantId ? { ...r, status: 'approved' } : r
      ));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve registrant';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const rejectRegistrant = async (registrantId: string, reason: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/registrants/${registrantId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) throw new Error('Failed to reject registrant');

      setRegistrants(prev => prev.map(r => 
        r.id === registrantId ? { ...r, status: 'rejected', rejection_reason: reason } : r
      ));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject registrant';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load of events
  useEffect(() => {
    fetchEvents({ status: 'upcoming' });
  }, []);

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

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
};

export const useEvents = (): EventContextType => {
  const context = useContext(EventContext);
  if (context === undefined) {
    throw new Error('useEvents must be used within an EventProvider');
  }
  return context;
};