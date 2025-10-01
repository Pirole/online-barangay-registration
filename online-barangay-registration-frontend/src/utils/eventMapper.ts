import type { BackendEvent } from '../context/EventContext';
import type { FrontendEvent } from '../components/events/EventCard';

export function mapEvent(be: BackendEvent): FrontendEvent {
  let startDate: Date | null = null;

  // ✅ Safely parse start_date
  if (be.start_date) {
    const parsed = new Date(be.start_date);
    if (!isNaN(parsed.getTime())) {
      startDate = parsed;
    }
  }

  return {
    id: be.id,
    title: be.title,
    description: be.description || '',
    date: startDate
      ? startDate.toISOString().split('T')[0] // yyyy-mm-dd
      : 'TBA',
    time: startDate
      ? startDate.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
      : '',
    location: be.location,
    capacity: be.capacity ?? 0,
    registeredCount: be.registration_count ?? 0,
    category: 'other', // fallback until backend provides
    status: be.status ?? 'upcoming', // fallback if backend doesn't send
    imageUrl: '/placeholder.png',
  };
}
