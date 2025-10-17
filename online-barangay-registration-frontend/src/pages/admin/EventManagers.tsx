import React, { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

interface Manager {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt?: string;
}

const EventManagers: React.FC = () => {
  const { token } = useAuth() as any;
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // ============================
  // LOAD EVENT MANAGERS
  // ============================
  const loadManagers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch("/event-managers", {}, token);
      setManagers(res.data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load event managers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManagers();
  }, []);

  // ============================
  // CREATE / UPDATE MANAGER
  // ============================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/event-managers/${editingId}` : "/event-managers";

    try {
      await apiFetch(
        url,
        {
          method,
          body: JSON.stringify(form),
        },
        token
      );
      alert(editingId ? "Event Manager updated!" : "Event Manager created!");
      setForm({ email: "", password: "", firstName: "", lastName: "" });
      setEditingId(null);
      loadManagers();
    } catch (err: any) {
      alert(err.message || "Operation failed");
    }
  };

  // ============================
  // DELETE MANAGER
  // ============================
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event manager?")) return;

    try {
      await apiFetch(`/event-managers/${id}`, { method: "DELETE" }, token);
      loadManagers();
    } catch (err: any) {
      alert(err.message || "Delete failed");
    }
  };

  // ============================
  // EDIT MANAGER
  // ============================
  const handleEdit = (m: Manager) => {
    setEditingId(m.id);
    setForm({
      email: m.email,
      password: "",
      firstName: m.firstName || "",
      lastName: m.lastName || "",
    });
  };

  // ============================
  // CANCEL EDIT
  // ============================
  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ email: "", password: "", firstName: "", lastName: "" });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Event Managers</h1>

      {/* ================= FORM SECTION ================= */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow mb-8 space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="border w-full rounded px-3 py-2"
              placeholder="Enter email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {editingId ? "New Password (optional)" : "Password"}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="border w-full rounded px-3 py-2"
              placeholder={editingId ? "Leave blank to keep current password" : "Enter password"}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="border w-full rounded px-3 py-2"
              placeholder="Enter first name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="border w-full rounded px-3 py-2"
              placeholder="Enter last name"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {editingId ? "Update Manager" : "Add Manager"}
          </button>
        </div>
      </form>

      {/* ================= TABLE SECTION ================= */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-medium mb-4">Current Event Managers</h2>

        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : managers.length === 0 ? (
          <p className="text-gray-500">No event managers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Name</th>
                  <th>Email</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-2">
                      {m.firstName || m.lastName
                        ? `${m.firstName || ""} ${m.lastName || ""}`
                        : "—"}
                    </td>
                    <td>{m.email}</td>
                    <td>
                      {m.createdAt
                        ? new Date(m.createdAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => handleEdit(m)}
                          className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventManagers;
