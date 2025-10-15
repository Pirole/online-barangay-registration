import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiFetch, API_BASE } from "../../lib/api";

interface Registrant {
  id: string;
  status: string;
  createdAt?: string;
  eventId?: string;
  eventTitle?: string;
  photoPath?: string | null;
  qrCodeUrl?: string | null;
  profile?: {
    firstName?: string | null;
    lastName?: string | null;
    contact?: string | null;
    age?: number | null;
    address?: string | null;
    barangay?: string | null;
  };
  customValues?: Record<string, any>;
}

const EventRegistrants: React.FC = () => {
  const { id: eventId } = useParams();
  const { token } = useAuth() as any;
  const navigate = useNavigate();

  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  useEffect(() => {
    const loadRegistrants = async () => {
      try {
        const res = await apiFetch(`/registrations/event/${eventId}`, {}, token);
        setRegistrants(res.data || []);
      } catch (err) {
        console.error("Failed to load registrants", err);
      } finally {
        setLoading(false);
      }
    };
    loadRegistrants();
  }, [eventId, token]);

  /**
   * ✅ Normalize any stored local/absolute path to a valid public URL
   * Handles Windows paths like:
   *   C:\Users\Ethan\...src\uploads\photos\photo-xxx.jpg
   * Converts to:
   *   http://localhost:5000/uploads/photos/photo-xxx.jpg
   */
  const normalizePath = (path?: string | null): string | null => {
    if (!path) return null;

    // Convert backslashes to forward slashes
    let fixed = path.replace(/\\/g, "/");

    // Remove everything before the "uploads/" part
    fixed = fixed.replace(/^.*uploads\//, "/uploads/");

    // Build full absolute URL from API base
    return `${API_BASE.replace("/api/v1", "")}${fixed}`;
  };

  /** ✅ Builds correct photo URL (photos inside src/uploads/photos) */
  const getPhotoUrl = (r: Registrant): string | null => {
    if (r.photoPath) return normalizePath(r.photoPath);
    if (r.customValues?.photoPath) return normalizePath(r.customValues.photoPath);
    if (r.customValues?.photo) return normalizePath(r.customValues.photo);
    return null;
  };

  /** ✅ Builds correct QR code URL (stored in uploads/qr outside src) */
  const getQrUrl = (r: Registrant): string | null => {
    const qr =
      r.qrCodeUrl ||
      r.customValues?.qrCodeUrl ||
      r.customValues?.qr ||
      null;
    return qr ? normalizePath(qr) : null;
  };

  /** ✅ Handles View QR modal */
  const handleViewQR = (r: Registrant) => {
    const qrUrl = getQrUrl(r);
    if (qrUrl) setQrPreview(qrUrl);
    else alert("No QR code available for this registrant.");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
      >
        ← Back
      </button>

      <h1 className="text-2xl font-semibold mb-4">Event Registrants</h1>

      {loading ? (
        <p>Loading...</p>
      ) : registrants.length === 0 ? (
        <p className="text-gray-500">No registrants found.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded shadow">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border-b">Photo</th>
                <th className="p-2 border-b">Full Name</th>
                <th className="p-2 border-b">Contact No.</th>
                <th className="p-2 border-b">Age</th>
                <th className="p-2 border-b">Address</th>
                <th className="p-2 border-b">Barangay</th>
                <th className="p-2 border-b">Status</th>
                <th className="p-2 border-b text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrants.map((r) => {
                const fullName =
                  `${r.profile?.firstName || ""} ${
                    r.profile?.lastName || ""
                  }`.trim() || "N/A";
                const photoUrl = getPhotoUrl(r);

                return (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 border-b text-center">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt="Registrant"
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <span className="text-gray-400">No Photo</span>
                      )}
                    </td>
                    <td className="p-2 border-b">{fullName}</td>
                    <td className="p-2 border-b">
                      {r.profile?.contact ||
                        (r.customValues?.contact as string) ||
                        "N/A"}
                    </td>
                    <td className="p-2 border-b">
                      {r.profile?.age ||
                        (r.customValues?.age as string) ||
                        "N/A"}
                    </td>
                    <td className="p-2 border-b">
                      {r.profile?.address ||
                        (r.customValues?.address as string) ||
                        "N/A"}
                    </td>
                    <td className="p-2 border-b">
                      {r.profile?.barangay ||
                        (r.customValues?.barangay as string) ||
                        "N/A"}
                    </td>
                    <td className="p-2 border-b capitalize">{r.status}</td>
                    <td className="p-2 border-b text-right">
                      <button
                        onClick={() => handleViewQR(r)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        View QR
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ✅ QR Code Modal */}
      {qrPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-sm text-center relative">
            <button
              className="absolute top-2 right-3 text-gray-600 hover:text-black"
              onClick={() => setQrPreview(null)}
            >
              ✕
            </button>
            <h2 className="text-lg font-semibold mb-3">Registrant QR Code</h2>
            <img
              src={qrPreview}
              alt="QR Code"
              className="mx-auto w-48 h-48 object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EventRegistrants;
