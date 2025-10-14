import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  details?: string;
}

const AuditLogs: React.FC = () => {
  const { user, token } = useAuth() as any;
  const role = (user?.role || "").toUpperCase();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async (): Promise<void> => {
    setLoading(true);
    try {
      const resp = await apiFetch("/admin/audit-logs", {}, token);
      setLogs(resp.data || []);
      setFilteredLogs(resp.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // Filtering logic
  useEffect(() => {
    let filtered = [...logs];
    if (filterUser.trim()) {
      filtered = filtered.filter((log) =>
        log.userName.toLowerCase().includes(filterUser.toLowerCase())
      );
    }
    if (filterAction.trim()) {
      filtered = filtered.filter((log) =>
        log.action.toLowerCase().includes(filterAction.toLowerCase())
      );
    }
    if (filterDate.trim()) {
      filtered = filtered.filter((log) =>
        log.timestamp.startsWith(filterDate)
      );
    }
    setFilteredLogs(filtered);
  }, [filterUser, filterAction, filterDate, logs]);

  const exportCSV = () => {
    if (!logs.length) return;
    const header = [
      "User",
      "Action",
      "Entity Type",
      "Entity ID",
      "Details",
      "Timestamp",
    ];
    const rows = logs.map((l) => [
      l.userName,
      l.action,
      l.entityType,
      l.entityId,
      l.details?.replace(/,/g, ";") || "",
      new Date(l.timestamp).toLocaleString(),
    ]);

    const csvContent = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit_logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        {role === "SUPER_ADMIN" && (
          <button
            onClick={exportCSV}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ⬇️ Export CSV
          </button>
        )}
      </div>

      {error && <div className="text-red-600 mb-3">{error}</div>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          placeholder="Filter by user"
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="border rounded p-2 w-40"
        />
        <input
          placeholder="Filter by action"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="border rounded p-2 w-40"
        />
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="border rounded p-2"
        />
        <button
          onClick={() => {
            setFilterUser("");
            setFilterAction("");
            setFilterDate("");
          }}
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
        >
          Clear
        </button>
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              <th className="py-2 px-2">User</th>
              <th className="px-2">Action</th>
              <th className="px-2">Entity</th>
              <th className="px-2">Entity ID</th>
              <th className="px-2">Details</th>
              <th className="px-2">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id} className="border-t hover:bg-gray-50">
                <td className="py-2 px-2">{log.userName}</td>
                <td className="px-2 font-medium text-blue-700">{log.action}</td>
                <td className="px-2">{log.entityType}</td>
                <td className="px-2 text-xs text-gray-600">{log.entityId}</td>
                <td className="px-2 max-w-xs truncate">{log.details}</td>
                <td className="px-2">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
              </tr>
            ))}
            {filteredLogs.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  No logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {loading && <div className="p-3 text-gray-500">Loading...</div>}
      </div>
    </div>
  );
};

export default AuditLogs;
