import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

type Role = "SUPER_ADMIN" | "EVENT_MANAGER" | "STAFF";

interface ShortEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  capacity?: number;
  age_min?: number;
  age_max?: number;
  category_id?: string;
  manager_id?: string;
  registration_count?: number;
  photo_path?: string;
}

interface EventFormData {
  title: string;
  description?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  capacity?: number;
  ageMin?: number;
  ageMax?: number;
  categoryId?: string;
  managerId?: string;
  photo?: File | null;
}

const AdminDashboard: React.FC = () => {
  const { user, token, logout } = useAuth() as any;
  const navigate = useNavigate();
  const role = (user?.role || "").toUpperCase() as Role | string;

  const [events, setEvents] = useState<ShortEvent[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<ShortEvent | null>(null);
  const [formData, setFormData] = useState<EventFormData>({
    title: "",
    description: "",
    location: "",
    startDate: "",
    endDate: "",
    categoryId: "",
    managerId: "",
    photo: null,
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  /* -------------------- FETCH DATA -------------------- */
  useEffect(() => {
    if (!token) return;

    const fetchEvents = async () => {
      setLoading(true);
      try {
        const res = await apiFetch("/events", {}, token);
        setEvents(res.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch events");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [token, refreshKey]);

  useEffect(() => {
    if (!token) return;

    const loadMeta = async () => {
      try {
        const [catRes, mgrRes] = await Promise.all([
          apiFetch("/categories", {}, token),
          apiFetch("/event-managers", {}, token),
        ]);
        setCategories(catRes.data || []);
        setManagers(mgrRes.data || []);
      } catch (err) {
        console.warn("Failed to load meta:", err);
      }
    };
    loadMeta();
  }, [token]);

  /* -------------------- HANDLERS -------------------- */
  const handleLogout = () => {
    logout?.();
    localStorage.clear();
    navigate("/login");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData({ ...formData, photo: file });
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  /* ---------- CREATE EVENT ---------- */
  const handleCreateEvent = async () => {
    try {
      setLoading(true);
      const data = new FormData();

      data.append("title", formData.title || "");
      data.append("description", formData.description || "");
      data.append("location", formData.location || "");
      data.append("startDate", formData.startDate || "");
      data.append("endDate", formData.endDate || "");
      if (formData.capacity) data.append("capacity", String(formData.capacity));
      if (formData.ageMin) data.append("ageMin", String(formData.ageMin));
      if (formData.ageMax) data.append("ageMax", String(formData.ageMax));
      if (formData.categoryId) data.append("categoryId", formData.categoryId);
      if (formData.managerId) data.append("managerId", formData.managerId);
      if (formData.photo) data.append("photo", formData.photo);

      await apiFetch("/events", { method: "POST", body: data }, token);
      toast.success("Event created successfully!");
      setShowCreateModal(false);
      refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- UPDATE EVENT ---------- */
  const openEditModal = (evt: ShortEvent) => {
    setSelectedEvent(evt);
    setFormData({
      title: evt.title,
      description: evt.description,
      location: evt.location,
      startDate: evt.start_date
        ? new Date(evt.start_date).toISOString().slice(0, 16)
        : "",
      endDate: evt.end_date
        ? new Date(evt.end_date).toISOString().slice(0, 16)
        : "",
      capacity: evt.capacity,
      ageMin: evt.age_min,
      ageMax: evt.age_max,
      categoryId: evt.category_id,
      managerId: evt.manager_id,
      photo: null,
    });
    setPhotoPreview(evt.photo_path ? `http://localhost:5000${evt.photo_path}` : null);
    setShowEditModal(true);
  };

  const handleUpdateEvent = async () => {
    if (!selectedEvent) return;
    try {
      setLoading(true);
      const data = new FormData();
      Object.entries(formData).forEach(([k, v]) => {
        if (v !== undefined && v !== null) data.append(k, String(v));
      });
      if (formData.photo) data.append("photo", formData.photo);

      await apiFetch(`/events/${selectedEvent.id}`, { method: "PUT", body: data }, token);
      toast.success("Event updated successfully!");
      setShowEditModal(false);
      refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update event");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- DELETE EVENT ---------- */
  const handleDeleteEvent = async () => {
    if (!deleteTargetId) return;
    try {
      setLoading(true);
      await apiFetch(`/events/${deleteTargetId}`, { method: "DELETE" }, token);
      toast.success("Event deleted successfully!");
      setShowDeleteModal(false);
      refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete event");
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- JSX -------------------- */
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-gray-600">
            Logged in as: <strong>{user?.email}</strong> ({role})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="px-3 py-1 bg-blue-600 text-white rounded">
            Refresh
          </button>
          {role === "SUPER_ADMIN" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1 bg-green-600 text-white rounded"
            >
              + Create Event
            </button>
          )}
          <button onClick={handleLogout} className="px-3 py-1 bg-gray-600 text-white rounded">
            Logout
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded shadow p-4">
        <h2 className="text-lg font-medium mb-3">Events</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th>Title</th>
                <th>Location</th>
                <th>Start</th>
                <th>Registrants</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr key={evt.id} className="border-t">
                  <td className="py-2">{evt.title}</td>
                  <td>{evt.location}</td>
                  <td>{evt.start_date ? new Date(evt.start_date).toLocaleString() : "-"}</td>
                  <td>{evt.registration_count ?? 0}</td>
                  <td className="flex gap-2 justify-end py-2">
                    <button
                      onClick={() => navigate(`/admin/events/${evt.id}/registrants`)}
                      className="px-3 py-1 bg-blue-600 text-white rounded"
                    >
                      Registrants
                    </button>
                    {(role === "SUPER_ADMIN" ||
                      (role === "EVENT_MANAGER" && evt.manager_id === user?.id)) && (
                      <button
                        onClick={() => openEditModal(evt)}
                        className="px-3 py-1 bg-yellow-500 text-white rounded"
                      >
                        Edit
                      </button>
                    )}
                    {role === "SUPER_ADMIN" && (
                      <button
                        onClick={() => {
                          setDeleteTargetId(evt.id);
                          setShowDeleteModal(true);
                        }}
                        className="px-3 py-1 bg-red-600 text-white rounded"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <Modal
          title="Create Event"
          formData={formData}
          setFormData={setFormData}
          photoPreview={photoPreview}
          handleFileChange={handleFileChange}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateEvent}
          loading={loading}
          categories={categories}
          managers={managers}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <Modal
          title="Edit Event"
          formData={formData}
          setFormData={setFormData}
          photoPreview={photoPreview}
          handleFileChange={handleFileChange}
          onClose={() => setShowEditModal(false)}
          onSave={handleUpdateEvent}
          loading={loading}
          categories={categories}
          managers={managers}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-md w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete this event? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-3 py-1 bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEvent}
                className="px-3 py-1 bg-red-600 text-white rounded"
                disabled={loading}
              >
                {loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------- REUSABLE MODAL COMPONENT -------------------- */
interface ModalProps {
  title: string;
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<EventFormData>>;
  photoPreview: string | null;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
  onSave: () => void;
  loading: boolean;
  categories: any[];
  managers: any[];
}

const Modal: React.FC<ModalProps> = ({
  title,
  formData,
  setFormData,
  photoPreview,
  handleFileChange,
  onClose,
  onSave,
  loading,
  categories,
  managers,
}) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded shadow-lg w-full max-w-2xl overflow-y-auto max-h-[90vh]">
      <h2 className="text-2xl font-semibold mb-6 text-center">{title}</h2>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full border rounded p-2"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
            <input
              type="datetime-local"
              value={formData.startDate || ""}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
            <input
              type="datetime-local"
              value={formData.endDate || ""}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full border rounded p-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
            <input
              type="number"
              value={formData.capacity || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  capacity: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full border rounded p-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
          {photoPreview && (
            <div className="mb-2">
              <img src={photoPreview} alt="Preview" className="h-32 object-cover rounded" />
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={formData.categoryId || ""}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="border rounded p-2 w-full"
            >
              <option value="">Select Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
            <select
              value={formData.managerId || ""}
              onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
              className="border rounded p-2 w-full"
            >
              <option value="">Select Manager</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.profile?.firstName || m.firstName} {m.profile?.lastName || m.lastName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6 gap-3">
        <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  </div>
);

export default AdminDashboard;
