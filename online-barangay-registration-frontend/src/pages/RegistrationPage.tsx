// src/pages/RegistrationPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useEvents } from "../context/EventContext";

type Mode = "individual" | "team";

interface Member {
  id?: string; // optional client-side id
  name: string;
  age: number | "";
  jerseyNumber?: string;
  size?: string;
  position?: string;
  photoDataUrl?: string | null;
}

interface IndividualForm {
  firstName: string;
  lastName: string;
  address: string;
  age: number | "";
  phone: string;
  barangay: string;
  jerseyNumber?: string;
  size?: string;
  position?: string;
  photo?: string; // dataURL
}

interface TeamForm {
  teamName: string;
  captain: IndividualForm;
  members: Member[];
}

interface OtpData {
  registrationId: string;
  code: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api/v1";

/**
 * Helper: convert dataURL to Blob (image/jpeg default)
 */
function dataUrlToBlob(dataUrl: string) {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

/**
 * Small safe phone validator (PH)
 */
const isValidPhone = (phone?: string) => {
  if (!phone) return false;
  return /^(\+63|0)9\d{9}$/.test(phone);
};

const RegistrationPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { selectedEvent, fetchEventById, registerForEvent, isLoading } = useEvents();

  // Steps: 1 = details, 2 = photo, 3 = OTP, 4 = QR success
  const [step, setStep] = useState<number>(1);
  const [mode, setMode] = useState<Mode | null>(null); // chosen by UI if event.mode === "both"
  const [individual, setIndividual] = useState<IndividualForm>({
    firstName: "",
    lastName: "",
    address: "",
    age: "",
    phone: "",
    barangay: "",
    jerseyNumber: "",
    size: "",
    position: "",
    photo: "",
  });

  const [team, setTeam] = useState<TeamForm>({
    teamName: "",
    captain: { ...individual },
    members: [],
  });

  const [otp, setOtp] = useState<OtpData>({ registrationId: "", code: "" });
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otpError, setOtpError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Camera refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Which photo we're capturing: "captain" | "member-index" | "individual"
  const [photoTarget, setPhotoTarget] = useState<"individual" | "captain" | `member-${number}`>("individual");

  useEffect(() => {
    if (eventId) fetchEventById(eventId);
    // default mode if event has only individual or team
    if (selectedEvent && !mode) {
      // Note: our Event object shape may vary; check property name.
      // Here we expect selectedEvent.registrationMode (string 'individual'|'team'|'both')
      const rm: any = (selectedEvent as any).registrationMode;
      if (rm === "individual") setMode("individual");
      else if (rm === "team") setMode("team");
      // if both, leave null so user chooses
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, fetchEventById, selectedEvent]);

  /* ---------------- Validation ---------------- */
  const validateIndividual = (data: IndividualForm) => {
    const e: Record<string, string> = {};
    if (!data.firstName || !data.firstName.trim()) e.firstName = "First name is required";
    if (!data.lastName || !data.lastName.trim()) e.lastName = "Last name is required";
    if (!data.address || !data.address.trim()) e.address = "Address is required";
    if (!data.barangay || !data.barangay.trim()) e.barangay = "Barangay is required";
    const age = Number(data.age);
    if (!data.age || isNaN(age) || age <= 0) e.age = "Valid age is required";
    if (!isValidPhone(data.phone)) e.phone = "Invalid Philippine mobile number (+63 or 09...)";
    return e;
  };

  const validateTeam = (t: TeamForm) => {
    const e: Record<string, string> = {};
    if (!t.teamName || !t.teamName.trim()) e.teamName = "Team name is required";
    const capErrors = validateIndividual(t.captain);
    Object.keys(capErrors).forEach((k) => (e[`captain.${k}`] = capErrors[k]));
    if (!t.members || t.members.length === 0) e.members = "Add at least one team member";
    // members basic validation
    t.members.forEach((m, i) => {
      if (!m.name || !m.name.trim()) e[`member.${i}.name`] = "Name required";
      const age = Number(m.age);
      if (!m.age || isNaN(age) || age <= 0) e[`member.${i}.age`] = "Valid age required";
    });
    return e;
  };

  /* ---------------- Camera / Photo logic ---------------- */
  const startCamera = async (target: "individual" | "captain" | `member-${number}` = "individual") => {
    setPhotoTarget(target);
    setCameraActive(false);
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch (err) {
      console.error("camera error", err);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const st = videoRef.current.srcObject as MediaStream;
      st.getTracks().forEach((t) => t.stop());
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPhotoPreview(dataUrl);

    // assign to correct target
    if (photoTarget === "individual") {
      setIndividual((p) => ({ ...p, photo: dataUrl }));
    } else if (photoTarget === "captain") {
      setTeam((t) => ({ ...t, captain: { ...t.captain, photo: dataUrl } }));
    } else if (typeof photoTarget === "string" && photoTarget.startsWith("member-")) {
      const idx = Number(photoTarget.split("-")[1]);
      setTeam((t) => {
        const members = [...t.members];
        members[idx] = { ...members[idx], photoDataUrl: dataUrl };
        return { ...t, members };
      });
    }
    stopCamera();
  };

  const handleFileSelect = (file: File | null, target: "individual" | "captain" | `member-${number}` = "individual", memberIndex?: number) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (target === "individual") setIndividual((p) => ({ ...p, photo: dataUrl }));
      else if (target === "captain") setTeam((t) => ({ ...t, captain: { ...t.captain, photo: dataUrl } }));
      else if (typeof target === "string" && target.startsWith("member-")) {
        const idx = Number(target.split("-")[1]);
        setTeam((t) => {
          const m = [...t.members];
          m[idx] = { ...m[idx], photoDataUrl: dataUrl };
          return { ...t, members: m };
        });
      }
    };
    reader.readAsDataURL(file);
  };

  /* ---------------- Team member helpers ---------------- */
  const addMember = () => {
    const limit = (selectedEvent as any)?.teamMemberSlots ?? 6;
    setTeam((t) => {
      if (t.members.length >= limit) return t;
      return { ...t, members: [...t.members, { name: "", age: "", jerseyNumber: "", size: "", position: "", photoDataUrl: null }] };
    });
  };

  const updateMemberField = (index: number, key: keyof Member, value: any) => {
    setTeam((t) => {
      const members = [...t.members];
      members[index] = { ...members[index], [key]: value };
      return { ...t, members };
    });
  };

  const removeMember = (index: number) => {
    setTeam((t) => ({ ...t, members: t.members.filter((_, i) => i !== index) }));
  };

  /* ---------------- SUBMIT FLOW ---------------- */
  // Individual submission uses existing context.registerForEvent to avoid breaking backend.
  const submitIndividual = async () => {
    setErrors({});
    const e = validateIndividual(individual);
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setLoading(true);
    try {
      // Build FormData just like existing frontend flow
      const fd = new FormData();
      fd.append("eventId", String((selectedEvent as any).id || eventId));
      const customValues = {
        firstName: individual.firstName,
        lastName: individual.lastName,
        address: individual.address,
        barangay: individual.barangay,
        age: individual.age,
        phone: individual.phone,
        jerseyNumber: individual.jerseyNumber,
        size: individual.size,
        position: individual.position,
      };
      fd.append("customValues", JSON.stringify(customValues));

      // attach photo if available
      if (individual.photo) {
        const blob = dataUrlToBlob(individual.photo);
        fd.append("photo", blob, "photo.jpg");
      }

      // Try to use context helper if available (keeps parity)
      if (registerForEvent) {
        const result = await registerForEvent(String((selectedEvent as any).id || eventId), fd);
        // NOTE: your registerForEvent in EventContext expects eventData, but the existing one uses FormData
        // If registerForEvent returns registrationId, use it.
        if (result?.registrationId) {
          setOtp({ registrationId: result.registrationId, code: "" });
          setStep(3);
        } else {
          // fallback: read response from fetch (if registerForEvent returned full body)
          setStep(3);
        }
      } else {
        // fallback direct fetch
        const res = await fetch(`${API_BASE}/registrations`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw res;
        const json = await res.json();
        setOtp({ registrationId: json.data.registrationId, code: "" });
        setStep(3);
      }
    } catch (err: any) {
      console.error("individual submit error", err);
      // if err is Response
      if (err?.json) {
        try {
          const payload = await err.json();
          setErrors({ general: payload.error || payload.message || "Registration failed" });
        } catch {
          setErrors({ general: "Registration failed" });
        }
      } else {
        setErrors({ general: err?.message || "Registration failed" });
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Team submit (approach A):
   * 1) POST /teams { eventId, name, captain: {...}, members: [...] }
   *  - expects server to create team + create a registration (so OTP created)
   * 2) Server should return registrationId (or OTP data). If it does, proceed to OTP step.
   *
   * NOTE: Because server contracts vary, this function will try to send structured JSON.
   * If response doesn't include `registrationId` we'll show helpful instructions (server must return reg id).
   */
  const submitTeam = async () => {
    setErrors({});
    const e = validateTeam(team);
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    setLoading(true);
    try {
      // Build payload
      const payload: any = {
        eventId: String((selectedEvent as any).id || eventId),
        name: team.teamName,
        captain: {
          firstName: team.captain.firstName,
          lastName: team.captain.lastName,
          address: team.captain.address,
          barangay: team.captain.barangay,
          age: team.captain.age,
          phone: team.captain.phone,
          jerseyNumber: team.captain.jerseyNumber,
          size: team.captain.size,
          position: team.captain.position,
        },
        members: team.members.map((m) => ({
          name: m.name,
          age: m.age,
          jerseyNumber: m.jerseyNumber,
          size: m.size,
          position: m.position,
        })),
      };

      // Include images as base64 strings if present (server must accept or we could send multipart)
      if (team.captain.photo) payload.captain.photo = team.captain.photo;
      team.members.forEach((m, i) => {
        if (m.photoDataUrl) payload.members[i].photo = m.photoDataUrl;
      });

      const res = await fetch(`${API_BASE}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        // show message from server
        setErrors({ general: json?.error || json?.message || "Team creation failed" });
        setLoading(false);
        return;
      }

      // Successful response — server SHOULD return either:
      // { success: true, data: { team, registrationId, otpSent: true } }
      // If registrationId exists, set OTP and move forward
      const registrationId = json?.data?.registrationId ?? json?.data?.registration?.id ?? json?.registrationId ?? null;
      if (registrationId) {
        setOtp({ registrationId, code: "" });
        setStep(3);
        setLoading(false);
        return;
      }

      // Some implementations (like your earlier sample) returned { team, otp } but no registration id.
      // If server returned otp and team but NO registration id, we can't proceed to verify without id.
      // Notify the admin/backend requirement.
      setErrors({
        general:
          "Team created but server did not return a registrationId. Frontend needs registrationId to continue OTP verification. Please update your /teams endpoint to return the created registration's id (or return otp+registrationId). Server response: " +
          (JSON.stringify(json)?.slice(0, 1000) ?? ""),
      });
    } catch (err) {
      console.error("submitTeam err", err);
      setErrors({ general: "Team creation failed (network or server error)" });
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- OTP verify ---------------- */
  const verifyOtp = async () => {
    if (!otp.code || otp.code.trim().length === 0) {
      setOtpError("Please enter OTP");
      return;
    }
    setOtpError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(otp),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? body?.message ?? "OTP verification failed");
      }
      const json = await res.json();
      // server should return QR path or value in data
      const qrImage = json?.data?.qr_image_path ? `${(import.meta.env.VITE_API_BASE || "http://localhost:5000")}${json.data.qr_image_path}` : null;
      const qrValue = json?.data?.qr_value ?? null;
      setQrUrl(qrImage ?? qrValue);
      setStep(4);
    } catch (err: any) {
      console.error("verify otp err", err);
      setOtpError(err?.message || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- UI helpers ---------------- */
  const actualMode: Mode = (() => {
    // Use selectedEvent.registrationMode if exists (we removed 'both' in agreement — but support fallback)
    const rm = (selectedEvent as any)?.registrationMode ?? (mode || "individual");
    if (rm === "both") return (mode as Mode) || "individual";
    return rm === "team" ? "team" : "individual";
  })();

  if (isLoading || !selectedEvent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-gray-600">Loading event...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold text-center mb-4">Register for { (selectedEvent as any).title }</h1>

        {/* If event allows both, show mode chooser */}
        {( (selectedEvent as any).registrationMode === "both" && !mode ) && (
          <div className="mb-6 text-center">
            <p className="text-gray-600 mb-3">Choose registration type</p>
            <div className="flex justify-center gap-4">
              <button onClick={() => setMode("individual")} className="px-6 py-2 bg-blue-600 text-white rounded-md">Individual</button>
              <button onClick={() => setMode("team")} className="px-6 py-2 bg-green-600 text-white rounded-md">Team (Captain)</button>
            </div>
          </div>
        )}

        {/* SHOW ERRORS */}
        {errors.general && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">{errors.general}</div>}

        {/* Step 1 - Details */}
        {step === 1 && actualMode === "individual" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">First name</label>
                <input value={individual.firstName} onChange={(e)=>setIndividual({...individual, firstName: e.target.value})} className="mt-1 p-2 w-full border rounded" />
                {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Last name</label>
                <input value={individual.lastName} onChange={(e)=>setIndividual({...individual, lastName: e.target.value})} className="mt-1 p-2 w-full border rounded" />
                {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Address</label>
              <input value={individual.address} onChange={(e)=>setIndividual({...individual, address: e.target.value})} className="mt-1 p-2 w-full border rounded" />
              {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Age</label>
                <input type="number" value={individual.age as any} onChange={(e)=>setIndividual({...individual, age: e.target.value ? Number(e.target.value) : ""})} className="mt-1 p-2 w-full border rounded" />
                {errors.age && <p className="text-red-500 text-sm mt-1">{errors.age}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Barangay</label>
                <input value={individual.barangay} onChange={(e)=>setIndividual({...individual, barangay: e.target.value})} className="mt-1 p-2 w-full border rounded" />
                {errors.barangay && <p className="text-red-500 text-sm mt-1">{errors.barangay}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <input value={individual.phone} onChange={(e)=>setIndividual({...individual, phone: e.target.value})} className="mt-1 p-2 w-full border rounded" />
                {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
              </div>
            </div>

            {/* Sports extras — show only if event category indicates sports (you may adapt logic) */}
            {((selectedEvent as any).category || "").toLowerCase().includes("sport") && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div>
                  <label className="text-sm font-medium">Jersey #</label>
                  <input value={individual.jerseyNumber} onChange={(e)=>setIndividual({...individual, jerseyNumber: e.target.value})} className="mt-1 p-2 w-full border rounded" />
                </div>
                <div>
                  <label className="text-sm font-medium">Size</label>
                  <input value={individual.size} onChange={(e)=>setIndividual({...individual, size: e.target.value})} className="mt-1 p-2 w-full border rounded" />
                </div>
                <div>
                  <label className="text-sm font-medium">Position</label>
                  <input value={individual.position} onChange={(e)=>setIndividual({...individual, position: e.target.value})} className="mt-1 p-2 w-full border rounded" />
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mt-4">
              <button onClick={() => { /* back to events */ }} className="text-gray-600">Cancel</button>
              <button onClick={() => { const e = validateIndividual(individual); if(Object.keys(e).length) setErrors(e); else setStep(2); }} className="bg-blue-600 text-white px-6 py-2 rounded">Continue to Photo</button>
            </div>
          </div>
        )}

        {/* Step 1 - Team captain & members */}
        {step === 1 && actualMode === "team" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Team Name</label>
              <input value={team.teamName} onChange={(e)=>setTeam({...team, teamName: e.target.value})} className="mt-1 p-2 w-full border rounded" />
              {errors.teamName && <p className="text-red-500 text-sm mt-1">{errors.teamName}</p>}
            </div>

            <div className="mt-2">
              <h3 className="font-semibold mb-2">Captain's Info</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="First name" value={team.captain.firstName} onChange={(e)=>setTeam(t=>({...t, captain:{...t.captain, firstName: e.target.value}}))} className="p-2 border rounded" />
                <input placeholder="Last name" value={team.captain.lastName} onChange={(e)=>setTeam(t=>({...t, captain:{...t.captain, lastName: e.target.value}}))} className="p-2 border rounded" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <input placeholder="Age" type="number" value={team.captain.age as any} onChange={(e)=>setTeam(t=>({...t, captain:{...t.captain, age: e.target.value ? Number(e.target.value) : ""}}))} className="p-2 border rounded" />
                <input placeholder="Barangay" value={team.captain.barangay} onChange={(e)=>setTeam(t=>({...t, captain:{...t.captain, barangay: e.target.value}}))} className="p-2 border rounded" />
                <input placeholder="Phone" value={team.captain.phone} onChange={(e)=>setTeam(t=>({...t, captain:{...t.captain, phone: e.target.value}}))} className="p-2 border rounded" />
              </div>

              {/* sports extras for captain */}
              {((selectedEvent as any).category || "").toLowerCase().includes("sport") && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <input placeholder="Jersey #" value={team.captain.jerseyNumber} onChange={(e)=>setTeam(t=>({...t, captain:{...t.captain, jerseyNumber: e.target.value}}))} className="p-2 border rounded" />
                  <input placeholder="Size" value={team.captain.size} onChange={(e)=>setTeam(t=>({...t, captain:{...t.captain, size: e.target.value}}))} className="p-2 border rounded" />
                  <input placeholder="Position" value={team.captain.position} onChange={(e)=>setTeam(t=>({...t, captain:{...t.captain, position: e.target.value}}))} className="p-2 border rounded" />
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Team Members ({team.members.length}/{(selectedEvent as any).teamMemberSlots ?? 6})</h4>
                <button onClick={addMember} className="text-sm text-green-600">+ Add member</button>
              </div>

              <div className="space-y-3 mt-3">
                {team.members.map((m, idx) => (
                  <div key={idx} className="p-3 border rounded bg-gray-50">
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium">Member #{idx+1}</div>
                      <button onClick={()=>removeMember(idx)} className="text-red-500 text-sm">Remove</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                      <input placeholder="Name" value={m.name} onChange={(e)=>updateMemberField(idx, "name", e.target.value)} className="p-2 border rounded" />
                      <input placeholder="Age" type="number" value={m.age as any} onChange={(e)=>updateMemberField(idx, "age", e.target.value ? Number(e.target.value) : "")} className="p-2 border rounded" />
                      <input placeholder="Jersey #" value={m.jerseyNumber} onChange={(e)=>updateMemberField(idx, "jerseyNumber", e.target.value)} className="p-2 border rounded" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <input placeholder="Size" value={m.size} onChange={(e)=>updateMemberField(idx, "size", e.target.value)} className="p-2 border rounded" />
                      <input placeholder="Position" value={m.position} onChange={(e)=>updateMemberField(idx, "position", e.target.value)} className="p-2 border rounded" />
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <label className="text-sm">Photo (optional)</label>
                      <input type="file" accept="image/*" onChange={(e)=>handleFileSelect(e.target.files?.[0] ?? null, `member-${idx}` as any)} />
                    </div>

                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center mt-4">
              <button onClick={() => { }} className="text-gray-600">Cancel</button>
              <button onClick={() => { const e = validateTeam(team); if(Object.keys(e).length) setErrors(e); else setStep(2); }} className="bg-green-600 text-white px-6 py-2 rounded">Continue to Photo</button>
            </div>
          </div>
        )}

        {/* Step 2 - Photo capture / upload */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Upload / Capture Photo</h3>
            <p className="text-gray-500 text-sm">Take or upload photo for {actualMode === "individual" ? "yourself" : "the captain" }</p>

            <div className="flex items-center gap-3 mt-3">
              <div>
                <button onClick={() => startCamera(actualMode === "individual" ? "individual" : "captain")} className="px-4 py-2 bg-blue-600 text-white rounded">Start Camera</button>
                <input className="ml-3" type="file" accept="image/*" onChange={(e)=>handleFileSelect(e.target.files?.[0] ?? null, actualMode==="individual" ? "individual" : "captain" as any)} />
              </div>
            </div>

            <div className="mt-4">
              {cameraActive && (
                <div className="mx-auto max-w-md">
                  <video ref={videoRef} className="w-full rounded bg-black" autoPlay playsInline muted />
                  <div className="flex justify-center gap-3 mt-2">
                    <button onClick={capture} className="px-4 py-2 bg-green-600 text-white rounded">Capture</button>
                    <button onClick={stopCamera} className="px-4 py-2 bg-gray-300">Stop</button>
                  </div>
                </div>
              )}

              {photoPreview && (
                <div className="mt-3">
                  <img src={photoPreview} alt="preview" className="mx-auto w-56 h-56 object-cover rounded" />
                </div>
              )}
            </div>

            <div className="flex justify-between mt-6">
              <button onClick={() => setStep(1)} className="px-4 py-2 border rounded">Back</button>
              <button onClick={() => {
                // if team, ensure captain photo exists (optional)
                if (actualMode === "individual") submitIndividual();
                else submitTeam();
              }} className="px-6 py-2 bg-blue-600 text-white rounded">
                {loading ? "Submitting..." : "Submit & Send OTP"}
              </button>
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {/* Step 3 - OTP */}
        {step === 3 && (
          <div className="space-y-4 text-center">
            <p className="text-gray-700">Enter the OTP sent to the captain's phone</p>
            <input value={otp.code} onChange={(e)=>setOtp({...otp, code: e.target.value})} className="mx-auto block p-2 border rounded text-center" placeholder="6-digit OTP" />
            {otpError && <p className="text-red-500">{otpError}</p>}
            <div className="flex justify-between mt-4">
              <button onClick={() => setStep(2)} className="px-4 py-2 border rounded">Back</button>
              <button onClick={verifyOtp} className="px-6 py-2 bg-green-600 text-white rounded">{loading ? "Verifying..." : "Verify OTP"}</button>
            </div>
          </div>
        )}

        {/* Step 4 - QR */}
        {step === 4 && (
          <div className="text-center space-y-4">
            <h3 className="text-xl font-semibold text-green-600">Registration Successful</h3>
            {qrUrl ? <img src={qrUrl} className="mx-auto w-40 h-40 object-contain border rounded" alt="QR" /> : <p className="text-gray-500">No QR available</p>}
            <Link to="/events" className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded">Back to Events</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegistrationPage;
