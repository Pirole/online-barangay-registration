// src/pages/RegistrationPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEvents } from '../context/EventContext';

interface FormData {
  name: string;
  address: string;
  age: number | '';
  phone: string;
  barangay: string;
  photo: string; // base64
}

interface OtpData {
  registrantId: string;
  code: string;
}

const RegistrationPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { selectedEvent, fetchEventById, registerForEvent, isLoading, error } = useEvents();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    address: '',
    age: '',
    phone: '',
    barangay: '',
    photo: ''
  });
  const [otpData, setOtpData] = useState<OtpData>({
    registrantId: '',
    code: ''
  });
  const [qrCode, setQrCode] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState('');
  
  // Photo capture refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');

  useEffect(() => {
    if (eventId) {
      fetchEventById(eventId);
    }
  }, [eventId, fetchEventById]);

  const validatePhone = (phone: string) => {
    const phoneRegex = /^(\+63|0)9\d{9}$/;
    return phoneRegex.test(phone);
  };

  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) errors.name = 'Pangalan ay required';
    if (!formData.address.trim()) errors.address = 'Address ay required';
    if (!formData.age || formData.age < 0) errors.age = 'Valid age ay required';
    if (!validatePhone(formData.phone)) errors.phone = 'Valid PH mobile number ay required (09XXXXXXXXX)';
    if (!formData.barangay.trim()) errors.barangay = 'Barangay ay required';
    
    // Check age restrictions
    if (selectedEvent && formData.age) {
      if (selectedEvent.age_min && formData.age < selectedEvent.age_min) {
        errors.age = `Minimum age is ${selectedEvent.age_min}`;
      }
      if (selectedEvent.age_max && formData.age > selectedEvent.age_max) {
        errors.age = `Maximum age is ${selectedEvent.age_max}`;
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('Hindi ma-access ang camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      context?.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      setFormData(prev => ({ ...prev, photo: imageData }));
      setPhotoPreview(imageData);
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setFormData(prev => ({ ...prev, photo: '' }));
    setPhotoPreview('');
    startCamera();
  };

  const handleStep1Next = () => {
    if (validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleStep2Next = () => {
    if (!formData.photo) {
      alert('Kumuha muna ng photo bago mag-continue');
      return;
    }
    setCurrentStep(3);
  };

  const sendOtp = async () => {
    try {
      const registrant = await registerForEvent(eventId!, formData);
      setOtpData(prev => ({ ...prev, registrantId: registrant.id }));
      setOtpSent(true);
      // In real implementation, OTP would be sent via SMS
      alert('OTP sent to your mobile number! (Demo: use 123456)');
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Failed to register');
    }
  };

  const verifyOtp = async () => {
    if (!otpData.code) {
      setOtpError('Please enter OTP code');
      return;
    }
    
    try {
      // Mock OTP verification - in real app, call backend
      if (otpData.code === '123456') {
        // Mock QR code - in real app, this comes from backend
        const mockQrCode = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==`;
        setQrCode(mockQrCode);
        setCurrentStep(4);
      } else {
        setOtpError('Invalid OTP code');
      }
    } catch (err) {
      setOtpError('OTP verification failed');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading event...</p>
        </div>
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Event not found</h2>
          <Link to="/events" className="text-blue-600 hover:text-blue-700">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/events" className="text-blue-600 hover:text-blue-700 text-sm">
            ← Back to Events
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">{selectedEvent.title}</h1>
          <p className="mt-2 text-gray-600">Mag-register para sa event na ito</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            {[
              { step: 1, label: 'Personal Info' },
              { step: 2, label: 'Photo' },
              { step: 3, label: 'OTP' },
              { step: 4, label: 'Confirmation' }
            ].map(({ step, label }) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= step 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {step}
                </div>
                <span className="ml-2 text-sm text-gray-600 hidden sm:block">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white shadow-lg rounded-lg p-6 md:p-8">
          {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Personal Information</h2>
              
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md mb-6">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        validationErrors.name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Juan Dela Cruz"
                    />
                    {validationErrors.name && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Age <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData(prev => ({ ...prev, age: Number(e.target.value) || '' }))}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        validationErrors.age ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="25"
                      min="0"
                    />
                    {validationErrors.age && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.age}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Complete Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      validationErrors.address ? 'border-red-300' : 'border-gray-300'
                    }`}
                    rows={3}
                    placeholder="123 Main St, Subdivision, City"
                  />
                  {validationErrors.address && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.address}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Barangay <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.barangay}
                      onChange={(e) => setFormData(prev => ({ ...prev, barangay: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        validationErrors.barangay ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Barangay San Jose"
                    />
                    {validationErrors.barangay && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.barangay}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        validationErrors.phone ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="09XX-XXX-XXXX"
                    />
                    {validationErrors.phone && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleStep1Next}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Next: Take Photo
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Photo Capture */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Take Your Photo</h2>
              
              <div className="text-center">
                {!photoPreview && !isCameraActive && (
                  <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8">
                    <div className="text-gray-500 mb-4">
                      <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 mb-4">Kumuha ng photo para sa registration</p>
                    <button
                      onClick={startCamera}
                      className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                    >
                      Open Camera
                    </button>
                  </div>
                )}

                {isCameraActive && (
                  <div className="space-y-4">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full max-w-md mx-auto rounded-lg"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="space-x-4">
                      <button
                        onClick={capturePhoto}
                        className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
                      >
                        Capture Photo
                      </button>
                      <button
                        onClick={stopCamera}
                        className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {photoPreview && (
                  <div className="space-y-4">
                    <img
                      src={photoPreview}
                      alt="Photo preview"
                      className="w-full max-w-md mx-auto rounded-lg"
                    />
                    <div className="space-x-4">
                      <button
                        onClick={retakePhoto}
                        className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700"
                      >
                        Retake Photo
                      </button>
                      <button
                        onClick={handleStep2Next}
                        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                      >
                        Next: Verify Phone
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-start">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  ← Back to Form
                </button>
              </div>
            </div>
          )}

          {/* Step 3: OTP Verification */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Phone Verification</h2>
              
              <div className="text-center">
                {!otpSent ? (
                  <div className="space-y-4">
                    <p className="text-gray-600">
                      We'll send an OTP to your mobile number: <strong>{formData.phone}</strong>
                    </p>
                    <button
                      onClick={sendOtp}
                      className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Sending...' : 'Send OTP'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-gray-600">
                      Enter the 6-digit code sent to {formData.phone}
                    </p>
                    <div className="max-w-xs mx-auto">
                      <input
                        type="text"
                        value={otpData.code}
                        onChange={(e) => setOtpData(prev => ({ ...prev, code: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="123456"
                        maxLength={6}
                      />
                    </div>
                    {otpError && (
                      <p className="text-red-500 text-sm">{otpError}</p>
                    )}
                    <div className="space-x-4">
                      <button
                        onClick={verifyOtp}
                        className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
                        disabled={isLoading}
                      >
                        {isLoading ? 'Verifying...' : 'Verify OTP'}
                      </button>
                      <button
                        onClick={() => setOtpSent(false)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        Resend OTP
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-start">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  ← Back to Photo
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {currentStep === 4 && (
            <div>
              <div className="text-center">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Successful!</h2>
                  <p className="text-gray-600">
                    Salamat! Your registration for <strong>{selectedEvent.title}</strong> has been submitted.
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <p className="text-yellow-800 text-sm">
                    <strong>Important:</strong> Your registration is pending approval. 
                    You'll receive a confirmation once approved by the event manager.
                  </p>
                </div>

                {qrCode && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-4">Your QR Code</h3>
                    <div className="bg-white p-4 border rounded-lg inline-block">
                      <img src={qrCode} alt="Registration QR Code" className="w-48 h-48 mx-auto" />
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Save or print this QR code for event check-in
                    </p>
                    <div className="mt-4 space-x-4">
                      <button
                        onClick={() => window.print()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                      >
                        Print QR Code
                      </button>
                      <a
                        href={qrCode}
                        download={`qr-${selectedEvent.title}.png`}
                        className="inline-block bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                      >
                        Download QR Code
                      </a>
                    </div>
                  </div>
                )}

                <div className="border-t pt-6">
                  <Link
                    to="/events"
                    className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700"
                  >
                    Back to Events
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegistrationPage;