// src/pages/admin/AdminDashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

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
  start_date?: string;
  end_date?: string;
  capacity?: number;
  age_min?: number;
  age_max?: number;
  managerId?: string;
  categoryId?: string;
  photo?: File | null;
}

const AdminDashboard: React.FC = () => {
  const { user, token, logout } = useAuth() as any;
  const navigate = useNavigate();
  const role = (user?.role || "").toUpperCase() as Role | string;

  const [events, setEvents] = useState<ShortEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [registrants, setRegistrants] = useState<RegistrantRow[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalRegistrants: 0,
    pendingApprovals: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<EventFormData>({
    title: "",
    description: "",
    location: "",
    start_date: "",
    end_date: "",
    managerId: "",
    categoryId: "",
    photo: null,
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);

  // 🔄 Load Events
  useEffect(() => {
    const load = async (): Promise<void> => {
      if (!token) {
        setError("No authentication token found.");
        return;
      }
      try {
        setLoadingEvents(true);
        setError(null);

        const eventsResp = await apiFetch(
          role === "EVENT_MANAGER" && user?.id
            ? `/events?managerId=${user.id}`
            : "/events",
          {},
          token
        );

        const evts: ShortEvent[] = (eventsResp?.data || []).map((e: any) => ({
          id: e.id,
          title: e.title,
          start_date: e.startDate || e.start_date,
          end_date: e.endDate || e.end_date,
          location: e.location,
          registration_count:
            e.registrationCount || e.registration_count || 0,
        }));

        setEvents(evts);
        setStats((s) => ({ ...s, totalEvents: evts.length }));
      } catch (error: any) {
        console.error("Failed loading events", error);
        setError(error.message || "Failed to load events");
      } finally {
        setLoadingEvents(false);
      }
    };

    load();
  }, [role, token, user?.id, refreshKey]);

  // 🔄 Load categories and event managers (for modal)
  useEffect(() => {
    const loadMeta = async () => {
      if (!token) return;
      try {
        const catRes = await apiFetch("/categories", {}, token);
        const mgrRes = await apiFetch("/event-managers", {}, token);
        setCategories(catRes.data || []);
        setManagers(mgrRes.data || []);
      } catch (err) {
        console.warn("Failed to load categories/managers");
      }
    };
    loadMeta();
  }, [token]);

  // 🔄 Load Registrants (Pending)
  useEffect(() => {
    const loadRegs = async (): Promise<void> => {
      if (!token) return;
      try {
        setLoadingRegs(true);
        setError(null);

        const arr: any[] = [];

        for (const e of events) {
          try {
            const r = await apiFetch(
              `/events/${e.id}/registrants?status=pending`,
              {},
              token
            );
            (r.data || []).forEach((reg: any) =>
              arr.push({ ...reg, eventTitle: e.title, eventId: e.id })
            );
          } catch {
            console.warn(`Failed to fetch registrants for event ${e.title}`);
          }
        }

        const regs: RegistrantRow[] = (arr || []).map((r: any) => ({
          id: r.id,
          eventId: r.eventId,
          eventTitle: r.eventTitle,
          profile: r.profile ?? {
            firstName:
              (r.customValues &&
                typeof r.customValues === "object" &&
                (r.customValues as any).firstName) ||
              "",
            lastName:
              (r.customValues &&
                typeof r.customValues === "object" &&
                (r.customValues as any).lastName) ||
              "",
            barangay:
              (r.customValues &&
                typeof r.customValues === "object" &&
                (r.customValues as any).barangay) ||
              "",
          },
          customValues: r.customValues ?? {},
          status: (r.status || "pending").toLowerCase(),
          created_at: r.createdAt || r.created_at,
        }));

        setRegistrants(regs);
        setStats((s) => ({
          ...s,
          totalRegistrants: regs.length,
          pendingApprovals: regs.filter(
            (reg) => reg.status === "pending"
          ).length,
        }));
      } catch (error: any) {
        console.error("Failed loading registrants", error);
        setError(error.message || "Failed to load registrants");
      } finally {
        setLoadingRegs(false);
      }
    };

    loadRegs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, token, refreshKey]);

  const refresh = (): void => setRefreshKey((k) => k + 1);

  const approveRegistrant = async (id: string): Promise<void> => {
    if (!confirm("Approve this registrant?")) return;
    try {
      await apiFetch(
        `/registrations/${id}/approval`,
        {
          method: "POST",
          body: JSON.stringify({ status: "approved" }),
        },
        token
      );
      refresh();
    } catch (error: any) {
      alert(error.message || "Approve failed");
    }
  };

  const rejectRegistrant = async (id: string): Promise<void> => {
    if (!confirm("Reject this registrant?")) return;
    try {
      await apiFetch(
        `/registrations/${id}/approval`,
        {
          method: "POST",
          body: JSON.stringify({ status: "rejected" }),
        },
        token
      );
      refresh();
    } catch (error: any) {
      alert(error.message || "Reject failed");
    }
  };

  const handleLogout = (): void => {
    if (logout) logout();
    else {
      localStorage.clear();
      sessionStorage.clear();
    }
    navigate("/login");
  };

  const handleCreateEvent = async (): Promise<void> => {
    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "")
        data.append(key, value as any);
    });

    try {
      await apiFetch("/events", { method: "POST", body: data }, token);
      alert("Event created successfully!");
      setModalOpen(false);
      setFormData({
        title: "",
        description: "",
        location: "",
        start_date: "",
        end_date: "",
        managerId: "",
        categoryId: "",
        photo: null,
      });
      refresh();
    } catch (error: any) {
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
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

      {/* Create Event Modal */}
      {modalOpen && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded shadow-lg w-full max-w-2xl overflow-y-auto max-h-[90vh]">
      <h2 className="text-xl font-semibold mb-4">Create New Event</h2>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            className="w-full border rounded p-2"
            placeholder="e.g. Barangay Tree-Planting Day"
          />
        </div>

        {/* Description */}
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
            placeholder="Short description of the event"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) =>
              setFormData({ ...formData, location: e.target.value })
            }
            className="w-full border rounded p-2"
            placeholder="Barangay Hall, Covered Court, etc."
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date / Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={formData.start_date || ""}
              onChange={(e) =>
                setFormData({ ...formData, start_date: e.target.value })
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
              value={formData.end_date || ""}
              onChange={(e) =>
                setFormData({ ...formData, end_date: e.target.value })
              }
              className="w-full border rounded p-2"
            />
          </div>
        </div>

        {/* Capacity + Photo */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacity (optional)
            </label>
            <input
              type="number"
              min="0"
              value={formData.capacity || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  capacity: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full border rounded p-2"
              placeholder="e.g. 200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Photo (optional)
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

        {/* Category + Manager */}
        <div className="grid grid-cols-2 gap-3">
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
                  {m.profile?.firstName} {m.profile?.lastName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-5 gap-2">
        <button
          onClick={() => setModalOpen(false)}
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
        <button
          onClick={handleCreateEvent}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save Event
        </button>
      </div>
    </div>
  </div>
)}

      {/* Summary cards */}
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

      {/* Events table */}
      <section className="mb-6 bg-white p-4 rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Events</h2>
          <div className="text-sm text-gray-500">
            {loadingEvents ? "Loading..." : `${events.length} events`}
          </div>
        </div>

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
                  <td>
                    {evt.start_date
                      ? new Date(evt.start_date).toLocaleString()
                      : "-"}
                  </td>
                  <td>{evt.registration_count ?? 0}</td>
                  <td className="text-right">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() =>
                          navigate(`/admin/events/${evt.id}/registrants`)
                        }
                        className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                      >
                        View Registrants
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {events.length === 0 && !loadingEvents && (
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

      {/* Pending registrants table */}
      <section className="bg-white p-4 rounded shadow">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Pending Registrants</h2>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Filter by Event:</label>
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
                const name =
                  `${row.profile?.firstName || ""} ${
                    row.profile?.lastName || ""
                  }`.trim() ||
                  row.customValues?.firstName ||
                  "Unnamed";
                return (
                  <tr className="border-t" key={row.id}>
                    <td className="py-2">{name}</td>
                    <td>{row.eventTitle || row.eventId}</td>
                    <td>
                      {row.profile?.barangay ||
                        row.customValues?.barangay ||
                        "-"}
                    </td>
                    <td>
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => approveRegistrant(row.id)}
                          className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectRegistrant(row.id)}
                          className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPending.length === 0 && !loadingRegs && (
                <tr>
                  <td colSpan={5} className="p-4 text-gray-500">
                    No pending registrants found for this event.
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
