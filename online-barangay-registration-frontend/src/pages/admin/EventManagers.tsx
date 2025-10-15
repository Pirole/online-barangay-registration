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
  const [form, setForm] = useState({ email: "", password: "", firstName: "", lastName: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadManagers = async () => {
    try {
      const res = await apiFetch("/event-managers", {}, token);
      setManagers(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManagers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/event-managers/${editingId}` : "/event-managers";
    try {
      await apiFetch(url, { method, body: JSON.stringify(form) }, token);
      alert(editingId ? "Event Manager updated!" : "Event Manager created!");
      setForm({ email: "", password: "", firstName: "", lastName: "" });
      setEditingId(null);
      loadManagers();
    } catch (err: any) {
      alert(err.message || "Operation failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event manager?")) return;
    try {
      await apiFetch(`/event-managers/${id}`, { method: "DELETE" }, token);
      loadManagers();
    } catch (err: any) {
      alert(err.message || "Delete failed");
    }
  };

  const handleEdit = (m: Manager) => {
    setEditingId(m.id);
    setForm({
      email: m.email,
      password: "",
      firstName: m.firstName || "",
      lastName: m.lastName || "",
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Event Managers</h1>

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow mb-6">
        <div className="grid grid-cols-2 gap-4">
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className="border rounded px-2 py-1"
          />
          <input
            type="password"
            placeholder={editingId ? "New Password (optional)" : "Password"}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="border rounded px-2 py-1"
          />
          <input
            type="text"
            placeholder="First Name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="border rounded px-2 py-1"
          />
          <input
            type="text"
            placeholder="Last Name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className="border rounded px-2 py-1"
          />
        </div>
        <div className="mt-3 flex justify-end gap-2">
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ email: "", password: "", firstName: "", lastName: "" });
              }}
              className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {editingId ? "Update Manager" : "Add Manager"}
          </button>
        </div>
      </form>

      <div className="bg-white p-4 rounded shadow">
        {loading ? (
          <p>Loading...</p>
        ) : managers.length === 0 ? (
          <p className="text-gray-500">No event managers found.</p>
        ) : (
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
                    {m.firstName} {m.lastName}
                  </td>
                  <td>{m.email}</td>
                  <td>{new Date(m.createdAt || "").toLocaleString()}</td>
                  <td className="text-right">
                    <button
                      onClick={() => handleEdit(m)}
                      className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 mr-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default EventManagers;
