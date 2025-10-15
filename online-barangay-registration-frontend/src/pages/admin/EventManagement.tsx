// src/pages/admin/EventManagement.tsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

interface EventData {
  id?: string;
  title: string;
  description?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  capacity?: number;
  age_min?: number;
  age_max?: number;
  registrant_count?: number;
}

interface Registrant {
  id: string;
  profile?: {
    firstName: string;
    lastName: string;
    barangay?: string;
  };
  status: string;
  createdAt: string;
}

// ====================
// EVENT CREATE/EDIT MODAL
// ====================
interface ModalProps {
  open: boolean;
  onClose: () => void;
  event?: EventData | null;
  onSave: (data: EventData) => void;
}

const EventModal: React.FC<ModalProps> = ({ open, onClose, event, onSave }) => {
  const [formData, setFormData] = useState<EventData>({
    title: "",
    description: "",
    location: "",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    if (event) {
      setFormData(event);
    } else {
      setFormData({
        title: "",
        description: "",
        location: "",
        start_date: "",
        end_date: "",
      });
    }
  }, [event]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    onSave(formData);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          {event ? "Edit Event" : "Create Event"}
        </h2>

        <div className="space-y-3">
          <input
            name="title"
            placeholder="Event Title"
            value={formData.title}
            onChange={handleChange}
            className="border w-full rounded p-2"
          />
          <textarea
            name="description"
            placeholder="Description"
            value={formData.description}
            onChange={handleChange}
            className="border w-full rounded p-2"
          />
          <input
            name="location"
            placeholder="Location"
            value={formData.location}
            onChange={handleChange}
            className="border w-full rounded p-2"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="datetime-local"
              name="start_date"
              value={formData.start_date || ""}
              onChange={handleChange}
              className="border w-full rounded p-2"
            />
            <input
              type="datetime-local"
              name="end_date"
              value={formData.end_date || ""}
              onChange={handleChange}
              className="border w-full rounded p-2"
            />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={onClose}
              className="px-3 py-1 rounded bg-gray-300 hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ====================
// REGISTRANTS MODAL
// ====================
interface RegistrantModalProps {
  open: boolean;
  onClose: () => void;
  eventId: string | null;
  token: string;
}

const RegistrantModal: React.FC<RegistrantModalProps> = ({
  open,
  onClose,
  eventId,
  token,
}) => {
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId || !open) return;
    const loadRegistrants = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(
          `/registrations/event/${eventId}?status=all`,
          {},
          token
        );
        setRegistrants(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadRegistrants();
  }, [eventId, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Event Registrants</h2>

        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : registrants.length === 0 ? (
          <div className="text-gray-500">No registrants found.</div>
        ) : (
          <table className="w-full text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Barangay</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Date Registered</th>
              </tr>
            </thead>
            <tbody>
              {registrants.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">
                    {r.profile
                      ? `${r.profile.firstName} ${r.profile.lastName}`
                      : "—"}
                  </td>
                  <td className="p-2">{r.profile?.barangay || "—"}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ====================
// MAIN PAGE
// ====================
const EventManagement: React.FC = () => {
  const { user, token } = useAuth() as any;
  const role = (user?.role || "").toUpperCase();
  const canEdit = ["SUPER_ADMIN", "EVENT_MANAGER"].includes(role);

  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [registrantModalOpen, setRegistrantModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const loadEvents = async (): Promise<void> => {
    setLoading(true);
    try {
      const resp = await apiFetch(
        role === "EVENT_MANAGER" && user?.id
          ? `/events?managerId=${user.id}`
          : "/events",
        {},
        token
      );
      setEvents(resp.data || []);
    } catch (error: any) {
      setError(error.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleSave = async (data: EventData): Promise<void> => {
    try {
      const method = data.id ? "PUT" : "POST";
      const url = data.id ? `/events/${data.id}` : `/events`;
      await apiFetch(
        url,
        {
          method,
          body: JSON.stringify(data),
        },
        token
      );
      setModalOpen(false);
      setEditingEvent(null);
      loadEvents();
    } catch (error: any) {
      alert(error.message || "Failed to save event");
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      await apiFetch(`/events/${id}`, { method: "DELETE" }, token);
      loadEvents();
    } catch (error: any) {
      alert(error.message || "Delete failed");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Event Management</h1>
        {canEdit && (
          <button
            onClick={() => {
              setEditingEvent(null);
              setModalOpen(true);
            }}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Create Event
          </button>
        )}
      </div>

      {error && <div className="text-red-600 mb-3">{error}</div>}

      <div className="bg-white p-4 rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600">
              <th className="py-2">Title</th>
              <th>Location</th>
              <th>Start</th>
              <th>End</th>
              <th>Registrants</th>
              {canEdit && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {events.map((evt) => (
              <tr key={evt.id} className="border-t">
                <td className="py-2">{evt.title}</td>
                <td>{evt.location || "-"}</td>
                <td>
                  {evt.start_date
                    ? new Date(evt.start_date).toLocaleString()
                    : "-"}
                </td>
                <td>
                  {evt.end_date ? new Date(evt.end_date).toLocaleString() : "-"}
                </td>
                <td>
                  <button
                    onClick={() => {
                      setSelectedEventId(evt.id!);
                      setRegistrantModalOpen(true);
                    }}
                    className="text-blue-600 hover:underline"
                  >
                    {evt.registrant_count || 0} view
                  </button>
                </td>
                {canEdit && (
                  <td className="text-right">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => {
                          setEditingEvent(evt);
                          setModalOpen(true);
                        }}
                        className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(evt.id!)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {events.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={canEdit ? 6 : 5}
                  className="p-4 text-center text-gray-500"
                >
                  No events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {loading && <div className="p-3 text-gray-500">Loading...</div>}
      </div>

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        event={editingEvent}
        onSave={handleSave}
      />

      <RegistrantModal
        open={registrantModalOpen}
        onClose={() => setRegistrantModalOpen(false)}
        eventId={selectedEventId}
        token={token}
      />
    </div>
  );
};

export default EventManagement;
