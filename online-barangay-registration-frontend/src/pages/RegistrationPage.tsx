// src/pages/RegistrationPage.tsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useEvents } from "../context/EventContext";

interface FormData {
  firstName: string;
  lastName: string;
  address: string;
  age: number | "";
  phone: string;
  barangay: string;
  photo: string;
}

interface OtpData {
  registrationId: string;
  code: string;
}

const RegistrationPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { selectedEvent, fetchEventById, registerForEvent, isLoading } = useEvents();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    address: "",
    age: "",
    phone: "",
    barangay: "",
    photo: "",
  });
  const [otpData, setOtpData] = useState<OtpData>({ registrationId: "", code: "" });
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [otpError, setOtpError] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [verifying, setVerifying] = useState(false);

  // Camera states
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const [cameraError, setCameraError] = useState("");

  /* ---------------- FETCH EVENT ---------------- */
  useEffect(() => {
    if (eventId) fetchEventById(eventId);
  }, [eventId, fetchEventById]);

  /* ---------------- VALIDATION ---------------- */
  const validatePhone = (phone: string) => /^(\+63|0)9\d{9}$/.test(phone);

  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    if (!formData.firstName.trim()) errors.firstName = "First name is required";
    if (!formData.lastName.trim()) errors.lastName = "Last name is required";
    if (!formData.address.trim()) errors.address = "Address is required";
    if (!formData.barangay.trim()) errors.barangay = "Barangay is required";
    if (!formData.age || formData.age <= 0) errors.age = "Valid age is required";
    if (!validatePhone(formData.phone)) errors.phone = "Invalid PH mobile number";

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* ---------------- CAMERA ---------------- */
  const startCamera = async () => {
  console.log("▶️ Starting camera...");
  setCameraError("");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    console.log("🎥 Stream tracks:", stream.getTracks());

    if (!videoRef.current) {
      console.warn("⚠️ videoRef.current is NULL at the time of stream setup!");
    }

    // Force mount the video before attaching
    setIsCameraActive(true);

    // Wait one tick for React to render <video>
    setTimeout(() => {
      if (videoRef.current) {
        console.log("✅ videoRef now exists, attaching stream");
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.play().catch((err) => console.warn("Autoplay blocked:", err));
      } else {
        console.warn("❌ videoRef still null even after render");
      }
    }, 300);
  } catch (err) {
    console.error("Camera access error:", err);
    setCameraError("Cannot access camera. Please check your browser settings.");
  }
};



  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setFormData((prev) => ({ ...prev, photo: dataUrl }));
    setPhotoPreview(dataUrl);
    stopCamera();
  };

  const retakePhoto = () => {
    setFormData((prev) => ({ ...prev, photo: "" }));
    setPhotoPreview("");
    startCamera();
  };

  /* ---------------- OTP ---------------- */
  const sendOtp = async () => {
    if (!validateStep1()) return;
    try {
      const result = await registerForEvent(eventId!, formData);
      setOtpData({ registrationId: result.id, code: "" });
      alert("OTP sent to your phone!");
      setCurrentStep(3);
    } catch {
      alert("Failed to send OTP. Try again.");
    }
  };

  const verifyOtp = async () => {
    if (!otpData.code.trim()) {
      setOtpError("Please enter OTP");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("http://localhost:5000/api/v1/otp/verify", {
        method: "POST", 
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(otpData),
      });
      if (!res.ok) throw new Error("Invalid OTP");

      const data = await res.json();
      if (data.data?.qr_image_path)
        setQrCodeUrl(`http://localhost:5000${data.data.qr_image_path}`);
      else if (data.data?.qr_value)
        setQrCodeUrl(data.data.qr_value);

      setCurrentStep(4);
    } catch {
      setOtpError("Invalid or expired OTP");
    } finally {
      setVerifying(false);
    }
  };

  /* ---------------- RENDER ---------------- */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Loading event...
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-lg font-semibold mb-4">Event not found</h2>
        <Link to="/events" className="text-blue-600 underline">
          Back to Events
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-center mb-6">
          Register for {selectedEvent.title}
        </h2>

        {/* Step indicator */}
        <div className="flex justify-between mb-8">
          {["Details", "Photo", "OTP", "QR"].map((label, i) => (
            <div
              key={label}
              className={`flex-1 text-center text-sm font-medium ${
                i + 1 <= currentStep ? "text-blue-600" : "text-gray-400"
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Step 1: Details */}
        {currentStep === 1 && (
          <div className="space-y-3">
            {["firstName", "lastName", "age", "address", "barangay", "phone"].map((field) => (
              <div key={field}>
                <input
                  type={field === "age" ? "number" : "text"}
                  name={field}
                  placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                  value={(formData as any)[field]}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
                  }
                  className="w-full border rounded p-2"
                />
                {validationErrors[field] && (
                  <p className="text-red-500 text-sm">{validationErrors[field]}</p>
                )}
              </div>
            ))}
            <button
              onClick={() => {
                if (validateStep1()) setCurrentStep(2);
              }}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Photo */}
        {currentStep === 2 && (
          <div className="text-center">
            {isCameraActive && (
              <div className="relative w-full max-w-md mx-auto bg-black rounded-lg overflow-hidden mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-auto rounded-lg bg-black"
                  style={{ transform: "scaleX(-1)", minHeight: "240px" }} // 👈 ensures visibility
                />
              </div>
            )}

            {photoPreview && !isCameraActive && (
              <div className="w-full max-w-md mx-auto mb-4">
                <img
                  src={photoPreview}
                  alt="Captured"
                  className="w-full h-auto rounded-lg shadow"
                />
              </div>
            )}

            {cameraError && (
              <p className="text-red-500 text-sm mb-3">{cameraError}</p>
            )}

            <div className="flex justify-center space-x-4">
              {!isCameraActive && !photoPreview && (
                <button
                  onClick={startCamera}
                  className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700"
                >
                  Start Camera
                </button>
              )}
              {isCameraActive && (
                <button
                  onClick={capturePhoto}
                  className="bg-green-600 text-white px-5 py-2 rounded hover:bg-green-700"
                >
                  Capture
                </button>
              )}
              {photoPreview && !isCameraActive && (
                <button
                  onClick={retakePhoto}
                  className="bg-yellow-500 text-white px-5 py-2 rounded hover:bg-yellow-600"
                >
                  Retake
                </button>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {photoPreview && (
              <div className="mt-6">
                <button
                  onClick={sendOtp}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: OTP */}
        {currentStep === 3 && (
          <div className="text-center space-y-4">
            <p>Enter the OTP sent to your phone:</p>
            <input
              type="text"
              value={otpData.code}
              onChange={(e) =>
                setOtpData((prev) => ({ ...prev, code: e.target.value }))
              }
              className="w-full border p-2 rounded text-center"
              placeholder="Enter 6-digit OTP"
            />
            {otpError && <p className="text-red-500 text-sm">{otpError}</p>}
            <button
              onClick={verifyOtp}
              disabled={verifying}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              {verifying ? "Verifying..." : "Verify OTP"}
            </button>
          </div>
        )}

        {/* Step 4: QR */}
        {currentStep === 4 && (
          <div className="text-center space-y-4">
            <h3 className="text-xl font-semibold text-green-600">
              Registration Successful!
            </h3>
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="QR Code" className="mx-auto w-40 h-40" />
            ) : (
              <p>No QR Code available</p>
            )}
            <p className="text-gray-600">
              Show this QR during the event for verification.
            </p>
            <Link
              to="/events"
              className="block bg-blue-600 text-white py-2 rounded mt-4"
            >
              Back to Events
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegistrationPage;
