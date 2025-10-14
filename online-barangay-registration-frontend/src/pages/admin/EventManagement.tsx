import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

interface EventData {
  id?: string;
  title: string;
  description?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  customFields?: Record<string, any>[];
}

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
    startDate: "",
    endDate: "",
    customFields: [],
  });

  const [customFieldInput, setCustomFieldInput] = useState(
    JSON.stringify(event?.customFields || [], null, 2)
  );

  useEffect(() => {
    if (event) {
      setFormData({
        id: event.id,
        title: event.title,
        description: event.description || "",
        location: event.location || "",
        startDate: event.startDate || "",
        endDate: event.endDate || "",
        customFields: event.customFields || [],
      });
      setCustomFieldInput(JSON.stringify(event.customFields || [], null, 2));
    } else {
      setFormData({
        title: "",
        description: "",
        location: "",
        startDate: "",
        endDate: "",
        customFields: [],
      });
      setCustomFieldInput("[]");
    }
  }, [event]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    try {
      const parsedFields = JSON.parse(customFieldInput || "[]");
      onSave({ ...formData, customFields: parsedFields });
    } catch {
      alert("Invalid JSON format in custom fields");
    }
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
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              className="border w-full rounded p-2"
            />
            <input
              type="datetime-local"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              className="border w-full rounded p-2"
            />
          </div>

          <label className="text-sm font-medium">Custom Fields (JSON)</label>
          <textarea
            value={customFieldInput}
            onChange={(e) => setCustomFieldInput(e.target.value)}
            className="border rounded p-2 font-mono text-sm w-full h-40"
          />

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

const EventManagement: React.FC = () => {
  const { user, token } = useAuth() as any;
  const role = (user?.role || "").toUpperCase();
  const canEdit = ["SUPER_ADMIN", "EVENT_MANAGER"].includes(role);

  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);

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
      const url = data.id ? `/admin/events/${data.id}` : `/admin/events`;
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
      await apiFetch(`/admin/events/${id}`, { method: "DELETE" }, token);
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
              <th>Custom Fields</th>
              {canEdit && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {events.map((evt) => (
              <tr key={evt.id} className="border-t">
                <td className="py-2">{evt.title}</td>
                <td>{evt.location || "-"}</td>
                <td>
                  {evt.startDate
                    ? new Date(evt.startDate).toLocaleString()
                    : "-"}
                </td>
                <td>
                  {evt.endDate ? new Date(evt.endDate).toLocaleString() : "-"}
                </td>
                <td>
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                    {evt.customFields?.length || 0} fields
                  </code>
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
    </div>
  );
};

export default EventManagement;
