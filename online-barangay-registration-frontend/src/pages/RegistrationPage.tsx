// src/pages/RegistrationPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
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
    
    // ✅ FIX: Use camelCase (FrontendEvent has ageMin, ageMax)
    if (selectedEvent && formData.age) {
      if (selectedEvent.ageMin && formData.age < selectedEvent.ageMin) {
        errors.age = `Minimum age is ${selectedEvent.ageMin}`;
      }
      if (selectedEvent.ageMax && formData.age > selectedEvent.ageMax) {
        errors.age = `Maximum age is ${selectedEvent.ageMax}`;
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
      if (otpData.code === '123456') {
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
    // ... ✅ KEEP THE REST AS-IS (UI for steps 1–4 unchanged)
    // The only real fix was switching age_min/age_max → ageMin/ageMax and removing `navigate`
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {/* ... (rest of JSX unchanged) */}
    </div>
  );
};

export default RegistrationPage;
