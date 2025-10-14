import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

interface UserData {
  id?: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "EVENT_MANAGER" | "STAFF";
  createdAt?: string;
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  user?: UserData | null;
  onSave: (data: UserData) => void;
}

const UserModal: React.FC<ModalProps> = ({ open, onClose, user, onSave }) => {
  const [formData, setFormData] = useState<UserData>({
    name: "",
    email: "",
    role: "STAFF",
  });
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) {
      setFormData({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } else {
      setFormData({ name: "", email: "", role: "STAFF" });
      setPassword("");
    }
  }, [user]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      alert("Name and Email are required.");
      return;
    }

    const payload: UserData & { password?: string } = { ...formData };
    if (!user && password.trim()) payload["password"] = password;
    onSave(payload);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          {user ? "Edit User" : "Create User"}
        </h2>

        <div className="space-y-3">
          <input
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            className="border w-full rounded p-2"
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            className="border w-full rounded p-2"
          />
          {!user && (
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border w-full rounded p-2"
            />
          )}
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="border w-full rounded p-2"
          >
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="EVENT_MANAGER">Event Manager</option>
            <option value="STAFF">Staff</option>
          </select>

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

const UserManagement: React.FC = () => {
  const { user, token } = useAuth() as any;
  const role = (user?.role || "").toUpperCase();
  const canEdit = role === "SUPER_ADMIN";

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  const loadUsers = async (): Promise<void> => {
    setLoading(true);
    try {
      const resp = await apiFetch("/admin/users", {}, token);
      setUsers(resp.data || []);
    } catch (error: any) {
      setError(error.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSave = async (data: UserData & { password?: string }) => {
    try {
      const method = data.id ? "PUT" : "POST";
      const url = data.id ? `/admin/users/${data.id}` : `/admin/users`;

      await apiFetch(
        url,
        {
          method,
          body: JSON.stringify(data),
        },
        token
      );

      setModalOpen(false);
      setEditingUser(null);
      loadUsers();
    } catch (error: any) {
      alert(error.message || "Failed to save user");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await apiFetch(`/admin/users/${id}`, { method: "DELETE" }, token);
      loadUsers();
    } catch (error: any) {
      alert(error.message || "Delete failed");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">User Management</h1>
        {canEdit && (
          <button
            onClick={() => {
              setEditingUser(null);
              setModalOpen(true);
            }}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Create User
          </button>
        )}
      </div>

      {error && <div className="text-red-600 mb-3">{error}</div>}

      <div className="bg-white p-4 rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600">
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
              {canEdit && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((usr) => (
              <tr key={usr.id} className="border-t">
                <td className="py-2">{usr.name}</td>
                <td>{usr.email}</td>
                <td>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      usr.role === "SUPER_ADMIN"
                        ? "bg-purple-100 text-purple-800"
                        : usr.role === "EVENT_MANAGER"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {usr.role}
                  </span>
                </td>
                <td>
                  {usr.createdAt
                    ? new Date(usr.createdAt).toLocaleString()
                    : "-"}
                </td>
                {canEdit && (
                  <td className="text-right">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => {
                          setEditingUser(usr);
                          setModalOpen(true);
                        }}
                        className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(usr.id!)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={canEdit ? 5 : 4}
                  className="p-4 text-center text-gray-500"
                >
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {loading && <div className="p-3 text-gray-500">Loading...</div>}
      </div>

      <UserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        user={editingUser}
        onSave={handleSave}
      />
    </div>
  );
};

export default UserManagement;
