// src/pages/RegistrationPage.tsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const {
    selectedEvent,
    fetchEventById,
    registerForEvent,
    isLoading,
    error,
  } = useEvents();

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
  const [otpData, setOtpData] = useState<OtpData>({
    registrationId: "",
    code: "",
  });
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [otpError, setOtpError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>("");

  // Fetch selected event
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
    if (!formData.age || formData.age <= 0)
      errors.age = "Valid age is required";
    if (!validatePhone(formData.phone))
      errors.phone = "Invalid PH mobile number (09XXXXXXXXX)";

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* ---------------- CAMERA ---------------- */
  const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    });

    if (videoRef.current) {
      videoRef.current.srcObject = stream;

      // ✅ Force the browser to start playing the stream
      await videoRef.current.play().catch((err) => {
        console.warn("Autoplay prevented:", err);
      });

      setIsCameraActive(true);
    }
  } catch (err) {
    console.error("Error accessing camera:", err);
    alert("Hindi ma-access ang camera. Please check permissions.");
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
    if (videoRef.current && canvasRef.current) {
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
    }
  };

  /* ---------------- OTP ---------------- */
  const sendOtp = async () => {
    if (!validateStep1()) return;
    try {
      const result = await registerForEvent(eventId!, formData);
      setOtpData((prev) => ({ ...prev, registrationId: result.id }));
      setOtpSent(true);
      alert("OTP has been sent to your phone number.");
      setCurrentStep(3);
    } catch (err) {
      alert("Failed to send OTP. Please try again.");
    }
  };

  const verifyOtp = async () => {
    if (!otpData.code.trim()) {
      setOtpError("Please enter your OTP code");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("http://localhost:5000/api/v1/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId: otpData.registrationId,
          code: otpData.code,
        }),
      });

      if (!res.ok) throw new Error("Verification failed");
      const data = await res.json();

      // Assuming backend now has generated QR image
      if (data.data?.qr_image_path) {
        setQrCodeUrl(`http://localhost:5000${data.data.qr_image_path}`);
      } else if (data.data?.qr_value) {
        // fallback: use qr_value + react-qr-code if needed
        setQrCodeUrl(data.data.qr_value);
      }
      setCurrentStep(4);
    } catch (err) {
      setOtpError("Invalid or expired OTP");
    } finally {
      setVerifying(false);
    }
  };

  /* ---------------- UI HANDLERS ---------------- */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        <p>Loading event...</p>
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold mb-4">Event not found</h2>
        <Link to="/events" className="text-blue-600 underline">
          Back to Events
        </Link>
      </div>
    );
  }

  /* ---------------- STEP UI ---------------- */
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-center">
          Register for {selectedEvent.title}
        </h2>

        {/* Step Indicator */}
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

        {/* STEP 1: INFO */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <input
              type="text"
              name="firstName"
              placeholder="First Name"
              value={formData.firstName}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />
            <input
              type="text"
              name="lastName"
              placeholder="Last Name"
              value={formData.lastName}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />
            <input
              type="number"
              name="age"
              placeholder="Age"
              value={formData.age}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />
            <input
              type="text"
              name="address"
              placeholder="Address"
              value={formData.address}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />
            <input
              type="text"
              name="barangay"
              placeholder="Barangay"
              value={formData.barangay}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />
            <input
              type="text"
              name="phone"
              placeholder="Phone (09XXXXXXXXX)"
              value={formData.phone}
              onChange={handleChange}
              className="w-full border p-2 rounded"
            />
            <button
              onClick={() => {
                if (validateStep1()) setCurrentStep(2);
              }}
              className="w-full bg-blue-600 text-white py-2 rounded"
            >
              Continue
            </button>
          </div>
        )}

        {/* STEP 2: PHOTO */}
        {currentStep === 2 && (
          <div className="text-center">
            {!photoPreview ? (
              <>
                {isCameraActive ? (
                  <div>
                    <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: "100%",
                      maxWidth: "360px",
                      borderRadius: "8px",
                      backgroundColor: "#000",
                      display: isCameraActive ? "block" : "none",
                    }}
                    onCanPlay={() => {
                      if (videoRef.current && !videoRef.current.onplaying) {
                        videoRef.current.play().catch((err) => {
                          console.warn("Autoplay prevented:", err);
                        });
                      }
                    }}
                  />
                    <div className="mt-4 flex justify-center gap-2">
                      <button
                        onClick={capturePhoto}
                        className="bg-green-600 text-white px-4 py-2 rounded"
                      >
                        Capture
                      </button>
                      <button
                        onClick={stopCamera}
                        className="bg-gray-400 text-white px-4 py-2 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={startCamera}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                  >
                    Start Camera
                  </button>
                )}
              </>
            ) : (
              <div>
                <img
                  src={photoPreview}
                  alt="Captured"
                  className="mx-auto rounded-lg mb-4 w-40 h-40 object-cover"
                />
                <button
                  onClick={() => {
                    setPhotoPreview("");
                    setFormData((prev) => ({ ...prev, photo: "" }));
                    startCamera();
                  }}
                  className="bg-yellow-500 text-white px-4 py-2 rounded"
                >
                  Retake Photo
                </button>
                <button
                  onClick={sendOtp}
                  className="ml-2 bg-blue-600 text-white px-4 py-2 rounded"
                >
                  Submit & Send OTP
                </button>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {/* STEP 3: OTP */}
        {currentStep === 3 && (
          <div className="space-y-4 text-center">
            <p>Enter the OTP sent to your phone:</p>
            <input
              type="text"
              value={otpData.code}
              onChange={(e) => setOtpData((prev) => ({ ...prev, code: e.target.value }))}
              className="w-full border p-2 rounded text-center"
              placeholder="Enter 6-digit OTP"
            />
            {otpError && <p className="text-red-500 text-sm">{otpError}</p>}
            <button
              onClick={verifyOtp}
              disabled={verifying}
              className="w-full bg-blue-600 text-white py-2 rounded"
            >
              {verifying ? "Verifying..." : "Verify OTP"}
            </button>
          </div>
        )}

        {/* STEP 4: QR */}
        {currentStep === 4 && (
          <div className="text-center space-y-4">
            <h3 className="text-xl font-semibold text-green-600">Registration Successful!</h3>
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="QR Code"
                className="mx-auto w-40 h-40"
              />
            ) : (
              <p>No QR Code available</p>
            )}
            <p className="text-gray-600">Show this QR during the event for verification.</p>
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
