// src/pages/admin/AdminDashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
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

const AdminDashboard: React.FC = () => {
  const { user, token } = useAuth() as any; // expects AuthContext to provide user and token
  const role = (user?.role || "").toUpperCase() as Role | string;

  const [events, setEvents] = useState<ShortEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [registrants, setRegistrants] = useState<RegistrantRow[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalRegistrants: 0,
    pendingApprovals: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async (): Promise<void> => {
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

  useEffect(() => {
    const loadRegs = async (): Promise<void> => {
      try {
        setLoadingRegs(true);
        setError(null);

        const resp = await apiFetch(
          "/registrations?status=pending&limit=50",
          {},
          token
        ).catch(async () => {
          // fallback: try per-event fetch if global route unavailable
          if (events.length === 0) return { data: [] };
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
              /* ignore */
            }
          }
          return { data: arr };
        });

        const regs: RegistrantRow[] = (resp?.data || []).map((r: any) => ({
          id: r.id,
          eventId: r.eventId ?? r.event_id,
          eventTitle: r.eventTitle ?? (r.event?.title || ""),
          profile: r.profile ?? {
            firstName: r.firstName,
            lastName: r.lastName,
            barangay: r.barangay,
          },
          customValues: r.customValues ?? r.custom_field_values,
          status: (r.status || r.state || "pending").toLowerCase(),
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
      await apiFetch(`/registrants/${id}/approve`, { method: "POST" }, token);
      refresh();
    } catch (error: any) {
      alert(error.message || "Approve failed");
    }
  };

  const rejectRegistrant = async (id: string): Promise<void> => {
    const reason = prompt("Reason for rejection (optional):") || "";
    try {
      await apiFetch(
        `/registrants/${id}/reject`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        },
        token
      );
      refresh();
    } catch (error: any) {
      alert(error.message || "Reject failed");
    }
  };

  const pending = useMemo(
    () => registrants.filter((r) => r.status === "pending"),
    [registrants]
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-600">
            Role: <strong>{role || "unknown"}</strong>
          </span>
          <button
            onClick={refresh}
            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="mb-4 text-red-600">{error}</div>}

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
          <th className="text-right">Actions</th> {/* ✅ new */}
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
                    window.location.href = `/admin/events/${evt.id}/registrants`
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
          <div className="text-sm text-gray-500">
            {loadingRegs ? "Loading..." : `${pending.length} pending`}
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
              {pending.map((row) => {
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
              {pending.length === 0 && !loadingRegs && (
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
