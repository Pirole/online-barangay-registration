import React from 'react';
import { Calendar, MapPin, Users, Clock } from 'lucide-react';

// Export the Event type so other components can use it
export interface FrontendEvent {
  id: string | number; // ✅ allow UUIDs from backend
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  capacity: number;
  registeredCount: number;
  category: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  imageUrl?: string;
  ageMin?: number;
  ageMax?: number;
  customFields?: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'select';
    required: boolean;
    options?: string[];
  }>;
}

interface EventCardProps {
  event: FrontendEvent;
  onRegisterClick?: (eventId: string | number) => void;
  compact?: boolean;
}

const EventCard: React.FC<EventCardProps> = ({ 
  event, 
  onRegisterClick,
  compact = false 
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-PH', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: FrontendEvent['status']) => {
    switch (status) {
      case 'upcoming':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'ongoing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryColor = (category: FrontendEvent['category']) => {
    switch (category) {
      case 'sports':
        return 'bg-orange-100 text-orange-800';
      case 'medical':
        return 'bg-red-100 text-red-800';
      case 'social':
        return 'bg-purple-100 text-purple-800';
      case 'seminar':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isRegistrationOpen = event.status === 'upcoming' && event.registeredCount < event.capacity;
  const spotsLeft = event.capacity - event.registeredCount;

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 ${compact ? 'h-auto' : 'h-full'}`}>
      {/* Event Image */}
      {event.imageUrl && (
        <div className="relative h-48 bg-gray-200">
          <img 
            src={event.imageUrl} 
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 left-3">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(event.category)}`}>
              {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
            </span>
          </div>
          <div className="absolute top-3 right-3">
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(event.status)}`}>
              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </span>
          </div>
        </div>
      )}

      {/* Event Content */}
      <div className="p-6">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-bold text-gray-900 line-clamp-2">
            {event.title}
          </h3>
        </div>

        {!compact && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {event.description}
          </p>
        )}

        {/* Event Details */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
            <span>{formatDate(event.date)} at {event.time}</span>
          </div>
          
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="w-4 h-4 mr-2 text-gray-400" />
            <span className="truncate">{event.location}</span>
          </div>
          
          <div className="flex items-center text-sm text-gray-600">
            <Users className="w-4 h-4 mr-2 text-gray-400" />
            <span>{event.registeredCount} / {event.capacity} registered</span>
          </div>

          {(event.ageMin || event.ageMax) && (
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="w-4 h-4 mr-2 text-gray-400" />
              <span>
                Age: {event.ageMin || 'Any'} - {event.ageMax || 'Any'} years old
              </span>
            </div>
          )}
        </div>

        {/* Capacity Warning */}
        {isRegistrationOpen && spotsLeft <= 10 && spotsLeft > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-amber-800 text-sm font-medium">
              Only {spotsLeft} spots left!
            </p>
          </div>
        )}

        {/* Registration Button */}
        <div className="flex flex-col space-y-2">
          {isRegistrationOpen ? (
          <button
            onClick={() => onRegisterClick?.(event.id)} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Register Now
          </button>

          ) : (
            <button
              disabled
              className="w-full bg-gray-300 text-gray-500 font-semibold py-3 px-4 rounded-lg cursor-not-allowed"
            >
              {event.status === 'completed' ? 'Event Completed' : 
               event.registeredCount >= event.capacity ? 'Fully Booked' : 'Registration Closed'}
            </button>
          )}
          
          <p className="text-xs text-gray-500 text-center">
            Registration requires photo verification & SMS OTP
          </p>
        </div>
      </div>
    </div>
  );
};

// Default export for the component
export default EventCard;
