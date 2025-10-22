import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type Role = "SUPER_ADMIN" | "EVENT_MANAGER" | "STAFF";

interface ShortEvent {
  id: string;
  title: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  registration_count?: number;
}

interface RegistrantRow {
  id: string;
  eventId?: string;
  eventTitle?: string;
  profile?: { firstName?: string; lastName?: string; barangay?: string };
  customValues?: Record<string, any>;
  status: string;
  created_at?: string;
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
  const [registrants, setRegistrants] = useState<RegistrantRow[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalRegistrants: 0,
    pendingApprovals: 0,
  });
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

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  // ✅ Load Events (auto-scoped by backend)
useEffect(() => {
  if (!token) return;

  const fetchEvents = async () => {
    setLoading(true);
    try {
      // Backend now auto-scopes based on role
      const res = await apiFetch("/events", {}, token);

      const data: ShortEvent[] = (res.data || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        start_date: e.startDate || e.start_date,
        end_date: e.endDate || e.end_date,
        location: e.location,
        registration_count: e.registrationCount || e.registration_count || 0,
      }));

      setEvents(data);
      setStats((s) => ({ ...s, totalEvents: data.length }));
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  fetchEvents();
}, [token, refreshKey]);


  // ✅ Load Categories and Managers
  useEffect(() => {
    const loadMeta = async () => {
      if (!token) return;
      try {
        const [catRes, mgrRes] = await Promise.all([
          apiFetch("/categories", {}, token),
          apiFetch("/event-managers", {}, token),
        ]);
        setCategories(catRes.data || []);
        setManagers(mgrRes.data || []);
      } catch (err) {
        console.warn("Failed loading categories or managers:", err);
      }
    };
    loadMeta();
  }, [token]);

  // ✅ Load Registrants (Pending)
  useEffect(() => {
    const loadRegs = async () => {
      if (!token) return;
      try {
        const allRegs: any[] = [];
        for (const evt of events) {
          try {
            const res = await apiFetch(
              `/events/${evt.id}/registrants?status=pending`,
              {},
              token
            );
            (res.data || []).forEach((r: any) =>
              allRegs.push({ ...r, eventId: evt.id, eventTitle: evt.title })
            );
          } catch {
            console.warn(`Failed to fetch registrants for ${evt.title}`);
          }
        }

        const formatted = allRegs.map((r: any) => ({
          id: r.id,
          eventId: r.eventId,
          eventTitle: r.eventTitle,
          profile: r.profile ?? {
            firstName: r.customValues?.firstName || "",
            lastName: r.customValues?.lastName || "",
            barangay: r.customValues?.barangay || "",
          },
          status: (r.status || "pending").toLowerCase(),
          created_at: r.createdAt || r.created_at,
        }));

        setRegistrants(formatted);
        setStats({
          totalEvents: events.length,
          totalRegistrants: formatted.length,
          pendingApprovals: formatted.filter(
            (r) => r.status === "pending"
          ).length,
        });
      } catch (err) {
        console.error("Failed loading registrants:", err);
      }
    };
    if (events.length > 0) loadRegs();
  }, [events, token, refreshKey]);

  // ✅ Approve / Reject
  const updateRegistrant = async (id: string, status: string) => {
    if (!confirm(`Are you sure to ${status} this registrant?`)) return;
    try {
      await apiFetch(
        `/registrations/${id}/approval`,
        {
          method: "POST",
          body: JSON.stringify({ status }),
        },
        token
      );
      refresh();
    } catch (err: any) {
      alert(err.message || `Failed to ${status}`);
    }
  };

  // ✅ Logout
  const handleLogout = () => {
    logout?.();
    localStorage.clear();
    sessionStorage.clear();
    navigate("/login");
  };

  // ✅ Create Event
  const handleCreateEvent = async (): Promise<void> => {
  try {
    console.log("🧾 Raw formData before send:", formData);

    // Convert datetime-local to ISO with timezone
    const startISO = formData.startDate
      ? new Date(formData.startDate).toISOString()
      : "";
    const endISO = formData.endDate
      ? new Date(formData.endDate).toISOString()
      : "";

    const data = new FormData();

    // ✅ Must match your backend exactly
    data.append("title", formData.title || "");
    data.append("description", formData.description || "");
    data.append("location", formData.location || "");
    data.append("startDate", startISO);
    data.append("endDate", endISO);
    if (formData.capacity) data.append("capacity", String(formData.capacity));
    if (formData.ageMin) data.append("ageMin", String(formData.ageMin));
    if (formData.ageMax) data.append("ageMax", String(formData.ageMax));
    if (formData.categoryId) data.append("categoryId", formData.categoryId);
    if (formData.managerId) data.append("managerId", formData.managerId);
    if (formData.photo) data.append("photo", formData.photo);

    // 🧠 Debug print: see what’s being sent
    for (const [key, value] of data.entries()) {
      console.log("➡️ Sending", key, "=", value);
    }

    const response = await apiFetch("/events", { method: "POST", body: data }, token);
    console.log("✅ Response:", response);

    alert("✅ Event created successfully!");
    setModalOpen(false);
    refresh();
  } catch (error: any) {
    console.error("❌ Create event failed:", error);
    alert(error.message || "Failed to create event");
  }
};



  const pending = useMemo(
    () => registrants.filter((r) => r.status === "pending"),
    [registrants]
  );

  const filteredPending =
    selectedEventId === "all"
      ? pending
      : pending.filter((r) => r.eventId === selectedEventId);

  // ✅ UI
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-gray-600">
            Logged in as: <strong>{user?.email || "Unknown"}</strong> ({role})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Refresh
          </button>
          {role === "SUPER_ADMIN" && (
            <button
              onClick={() => setModalOpen(true)}
              className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
            >
              + Create Event
            </button>
          )}
          <button
            onClick={handleLogout}
            className="px-3 py-1 rounded bg-gray-600 text-white hover:bg-gray-700"
          >
            Logout
          </button>
          <button
            onClick={() => navigate("/admin/event-managers")}
            className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Manage Event Managers
          </button>
        </div>
      </div>

      {/* Modal: Create Event */}
      {/* ✅ Create Event Modal */}
{modalOpen && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded shadow-lg w-full max-w-2xl overflow-y-auto max-h-[90vh]">
      <h2 className="text-2xl font-semibold mb-6 text-center">Create New Event</h2>

      <div className="space-y-5">
        {/* ───── Title & Description ───── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full border rounded p-2"
            placeholder="e.g. Barangay Clean-Up Drive"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="w-full border rounded p-2"
            rows={3}
            placeholder="Short event description (optional)"
          />
        </div>

        {/* ───── Location ───── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full border rounded p-2"
            placeholder="e.g. Barangay Hall, Covered Court, etc."
          />
        </div>

        {/* ───── Dates ───── */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date / Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={formData.startDate || ""}
              onChange={(e) =>
                setFormData({ ...formData, startDate: e.target.value })
              }
              className="w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date / Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={formData.endDate || ""}
              onChange={(e) =>
                setFormData({ ...formData, endDate: e.target.value })
              }
              className="w-full border rounded p-2"
            />
          </div>
        </div>

        {/* ───── Capacity + Photo ───── */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacity (optional)
            </label>
            <input
              type="number"
              min="1"
              value={formData.capacity || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  capacity: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full border rounded p-2"
              placeholder="e.g. 100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upload Photo (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  photo: e.target.files ? e.target.files[0] : null,
                })
              }
              className="w-full border rounded p-2"
            />
          </div>
        </div>

        {/* ───── Category & Manager ───── */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.categoryId || ""}
              onChange={(e) =>
                setFormData({ ...formData, categoryId: e.target.value })
              }
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign Manager <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.managerId || ""}
              onChange={(e) =>
                setFormData({ ...formData, managerId: e.target.value })
              }
              className="border rounded p-2 w-full"
            >
              <option value="">Select Event Manager</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.profile?.firstName || m.firstName || ""}{" "}
                  {m.profile?.lastName || m.lastName || ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ───── Buttons ───── */}
      <div className="flex justify-end mt-6 gap-3">
        <button
          onClick={() => setModalOpen(false)}
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
        <button
          onClick={() => handleCreateEvent()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save Event
        </button>
      </div>
    </div>
  </div>
)}


      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Total Events</div>
          <div className="text-2xl font-bold">{stats.totalEvents}</div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Total Registrants</div>
          <div className="text-2xl font-bold">{stats.totalRegistrants}</div>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Pending Approvals</div>
          <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
        </div>
      </div>

      {/* Events Table */}
      <section className="mb-6 bg-white p-4 rounded shadow">
        <h2 className="text-lg font-medium mb-3">Events</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-2">Title</th>
                <th>Location</th>
                <th>Start</th>
                <th>Registrants</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr key={evt.id} className="border-t">
                  <td className="py-2">{evt.title}</td>
                  <td>{evt.location}</td>
                  <td>{evt.start_date ? new Date(evt.start_date).toLocaleString() : "-"}</td>
                  <td>{evt.registration_count ?? 0}</td>
                  <td className="text-right">
                    <button
                      onClick={() => navigate(`/admin/events/${evt.id}/registrants`)}
                      className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                      View Registrants
                    </button>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-gray-500">
                    No events found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pending Registrants */}
      <section className="bg-white p-4 rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Pending Registrants</h2>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="all">All Events</option>
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.title}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-2">Name</th>
                <th>Event</th>
                <th>Barangay</th>
                <th>Submitted</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPending.map((row) => {
                const name = `${row.profile?.firstName || ""} ${
                  row.profile?.lastName || ""
                }`.trim() || "Unnamed";
                return (
                  <tr className="border-t" key={row.id}>
                    <td className="py-2">{name}</td>
                    <td>{row.eventTitle}</td>
                    <td>{row.profile?.barangay || "-"}</td>
                    <td>
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => updateRegistrant(row.id, "approved")}
                          className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateRegistrant(row.id, "rejected")}
                          className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPending.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-gray-500">
                    No pending registrants.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
