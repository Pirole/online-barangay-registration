import { Event as BackendEvent } from '../context/EventContext';
import { Event as FrontendEvent } from '../components/events/EventCard';

export function mapEvent(be: BackendEvent): FrontendEvent {
  const startDate = new Date(be.start_date);
  return {
    id: Number.isNaN(Number(be.id)) ? Date.now() : Number(be.id), // temp fallback
    title: be.title,
    description: be.description || '',
    date: startDate.toISOString().split('T')[0], // yyyy-mm-dd
    time: startDate.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
    location: be.location,
    capacity: be.capacity ?? 0,
    registeredCount: be.registration_count ?? 0,
    category: 'other', // until backend provides category
    status: be.status,
    imageUrl: '/placeholder.png', // fallback
  };
}
