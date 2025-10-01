import type { Event as BackendEvent } from '../context/EventContext';
import type { Event as FrontendEvent } from '../components/events/EventCard';

export function mapEvent(be: BackendEvent): FrontendEvent {
  const startDate = new Date(be.start_date);

  return {
    id: be.id, // ✅ keep as string (UUID) or number
    title: be.title,
    description: be.description || '',
    date: startDate.toISOString().split('T')[0], // yyyy-mm-dd
    time: startDate.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
    location: be.location,
    capacity: be.capacity ?? 0,
    registeredCount: (be as any).registration_count ?? 0, // ✅ backend may not provide yet
    category: 'other', // fallback until backend sends category
    status: (be as any).status ?? 'upcoming', // ✅ fallback if backend doesn't send
    imageUrl: '/placeholder.png', // fallback image
  };
}
