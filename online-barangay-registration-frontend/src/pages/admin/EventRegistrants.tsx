import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

const EventRegistrants: React.FC = () => {
  const { id: eventId } = useParams();
  const { token } = useAuth() as any;
  const navigate = useNavigate();

  const [registrants, setRegistrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRegistrants = async () => {
      try {
        const res = await apiFetch(`/registrations/event/${eventId}`, {}, token);
        setRegistrants(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadRegistrants();
  }, [eventId, token]);

  return (
    <div className="p-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
      >
        ← Back
      </button>

      <h1 className="text-xl font-semibold mb-4">Registrants</h1>

      {loading ? (
        <p>Loading...</p>
      ) : registrants.length === 0 ? (
        <p className="text-gray-500">No registrants found.</p>
      ) : (
        <table className="w-full bg-white border rounded shadow text-sm">
          <thead>
            <tr>
              <th className="p-2 border-b">Name</th>
              <th className="p-2 border-b">Barangay</th>
              <th className="p-2 border-b">Status</th>
            </tr>
          </thead>
          <tbody>
            {registrants.map((r) => (
              <tr key={r.id}>
                <td className="p-2 border-b">
                  {r.profile
                    ? `${r.profile.firstName} ${r.profile.lastName}`
                    : "N/A"}
                </td>
                <td className="p-2 border-b">
                  {r.profile?.barangay || "N/A"}
                </td>
                <td className="p-2 border-b">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default EventRegistrants;
