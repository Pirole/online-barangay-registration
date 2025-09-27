import React from 'react';
import { Calendar, MapPin, Users } from 'lucide-react';

export interface Event {
  id: number;
  title: string;
  category: string;
  date: string;
  location: string;
  capacity: string;
  isFeatured: boolean;
  description: string;
}

interface EventCardProps {
  event: Event;
  onRegisterClick?: (eventId: number) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, onRegisterClick }) => {
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Sports: 'bg-blue-100 text-blue-800',
      Medical: 'bg-red-100 text-red-800',
      Civic: 'bg-green-100 text-green-800',
      Education: 'bg-purple-100 text-purple-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const handleRegisterClick = () => {
    onRegisterClick?.(event.id);
  };

  return (
    <div className={`bg-white rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 overflow-hidden border ${
      event.isFeatured ? 'border-yellow-400 ring-2 ring-yellow-200' : 'border-gray-200'
    }`}>
      {event.isFeatured && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-center py-2 text-sm font-semibold">
          ⭐ Featured Event
        </div>
      )}
      
      <div className="h-48 md:h-48 bg-gradient-to-br from-blue-100 to-red-100 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-10 md:w-12 h-10 md:h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Event Photo</p>
        </div>
      </div>
      
      <div className="p-4 md:p-6">
        <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-3 ${getCategoryColor(event.category)}`}>
          {event.category}
        </div>
        
        <h3 className="text-lg font-bold text-gray-800 mb-2">{event.title}</h3>
        <p className="text-gray-600 text-sm mb-4">{event.description}</p>
        
        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-gray-400" />
            {event.date}
          </div>
          <div className="flex items-center">
            <MapPin className="w-4 h-4 mr-2 text-gray-400" />
            {event.location}
          </div>
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-2 text-gray-400" />
            {event.capacity}
          </div>
        </div>
        
        <button 
          onClick={handleRegisterClick}
          className="w-full bg-gradient-to-r from-blue-600 to-red-500 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all text-sm md:text-base"
        >
          Register Now
        </button>
      </div>
    </div>
  );
};

export default EventCard;