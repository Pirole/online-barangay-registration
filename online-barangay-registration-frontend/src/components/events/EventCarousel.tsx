import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import EventCard, { Event } from './EventCard';

interface EventCarouselProps {
  events: Event[];
  onEventRegister?: (eventId: number) => void;
  autoAdvance?: boolean;
  autoAdvanceInterval?: number;
}

const EventCarousel: React.FC<EventCarouselProps> = ({ 
  events, 
  onEventRegister, 
  autoAdvance = true,
  autoAdvanceInterval = 5000 
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-advance carousel
  useEffect(() => {
    if (!autoAdvance || events.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % events.length);
    }, autoAdvanceInterval);
    
    return () => clearInterval(timer);
  }, [events.length, autoAdvance, autoAdvanceInterval]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % events.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + events.length) % events.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-lg">No events available at the moment.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Desktop Carousel */}
      <div className="hidden md:block relative">
        <div className="overflow-hidden rounded-2xl">
          <div 
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${currentSlide * 25}%)` }}
          >
            {events.map((event) => (
              <div key={event.id} className="w-1/4 flex-shrink-0 px-3">
                <EventCard event={event} onRegisterClick={onEventRegister} />
              </div>
            ))}
          </div>
        </div>
        
        {/* Desktop Navigation Arrows */}
        {events.length > 4 && (
          <>
            <button 
              onClick={prevSlide}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 transition-all z-10"
              aria-label="Previous events"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>
            <button 
              onClick={nextSlide}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 transition-all z-10"
              aria-label="Next events"
            >
              <ChevronRight className="w-6 h-6 text-gray-600" />
            </button>
          </>
        )}
      </div>

      {/* Mobile Carousel */}
      <div className="md:hidden">
        <div className="relative overflow-hidden rounded-xl">
          <div 
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {events.map((event) => (
              <div key={event.id} className="w-full flex-shrink-0 px-4">
                <EventCard event={event} onRegisterClick={onEventRegister} />
              </div>
            ))}
          </div>
        </div>
        
        {/* Mobile Navigation Dots */}
        {events.length > 1 && (
          <div className="flex justify-center space-x-2 mt-4">
            {events.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentSlide ? 'bg-blue-600 scale-125' : 'bg-gray-300'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventCarousel;