import React, { useState, useEffect } from 'react';
import { Search, Filter, Calendar, MapPin, Users } from 'lucide-react';
import EventCard, { type Event } from '../components/events/EventCard';
import EventCarousel from '../components/events/EventCarousel';

const LandingPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Mock data for testing - replace with actual API call later
  useEffect(() => {
    const mockEvents: Event[] = [
      {
        id: 1,
        title: 'Barangay Basketball Tournament',
        description: 'Annual basketball tournament open to all residents aged 18-35. Teams of 5 players each.',
        date: '2024-03-15',
        time: '08:00 AM',
        location: 'Barangay Covered Court',
        capacity: 100,
        registeredCount: 45,
        category: 'sports',
        status: 'upcoming',
        ageMin: 18,
        ageMax: 35,
        imageUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'
      },
      {
        id: 2,
        title: 'Free Medical Check-up',
        description: 'Comprehensive health screening including blood pressure, blood sugar, and basic consultation.',
        date: '2024-03-20',
        time: '07:00 AM',
        location: 'Barangay Health Center',
        capacity: 50,
        registeredCount: 12,
        category: 'medical',
        status: 'upcoming',
        ageMin: 0,
        imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'
      },
      {
        id: 3,
        title: 'Community Clean-up Drive',
        description: 'Join us in keeping our barangay clean and beautiful. Lunch and snacks provided.',
        date: '2024-03-25',
        time: '06:00 AM',
        location: 'Barangay Hall',
        capacity: 200,
        registeredCount: 89,
        category: 'social',
        status: 'upcoming',
        ageMin: 12,
        imageUrl: 'https://images.unsplash.com/photo-1618477247222-acbdb0e159b3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'
      },
      {
        id: 4,
        title: 'Digital Literacy Seminar',
        description: 'Learn basic computer skills, internet safety, and online government services.',
        date: '2024-04-01',
        time: '02:00 PM',
        location: 'Multi-Purpose Hall',
        capacity: 30,
        registeredCount: 28,
        category: 'seminar',
        status: 'upcoming',
        ageMin: 18,
        imageUrl: 'https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'
      },
      {
        id: 5,
        title: 'Senior Citizens Day',
        description: 'Special celebration for our beloved senior citizens with entertainment and prizes.',
        date: '2024-04-05',
        time: '09:00 AM',
        location: 'Barangay Hall',
        capacity: 80,
        registeredCount: 65,
        category: 'social',
        status: 'upcoming',
        ageMin: 60,
        imageUrl: 'https://images.unsplash.com/photo-1544027993-37dbfe43562a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80'
      }
    ];

    // Simulate loading
    setTimeout(() => {
      setEvents(mockEvents);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || event.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredEvents = events.slice(0, 4); // First 4 events for carousel

  const handleRegisterClick = (eventId: number) => {
    console.log(`Register clicked for event ${eventId}`);
    // TODO: Navigate to registration form
    alert(`Registration for event ${eventId} - This will redirect to the registration form`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Welcome sa Aming Barangay
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100">
              Register sa mga events at activities para sa buong komunidad
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                View All Events
              </button>
              <button className="border border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors">
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Events Carousel */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Featured Events
            </h2>
            <p className="text-lg text-gray-600">
              Mga highlighted events na pwede mong i-register ngayon
            </p>
          </div>
          
          <EventCarousel 
            events={featuredEvents} 
            onEventRegister={handleRegisterClick}
            autoAdvance={true}
            autoAdvanceInterval={5000}
          />
        </div>
      </section>

      {/* Search and Filter Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              All Events
            </h2>
            <p className="text-lg text-gray-600">
              Browse lahat ng available events sa aming barangay
            </p>
          </div>

          {/* Search and Filter Controls */}
          <div className="mb-8 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white min-w-[200px]"
              >
                <option value="all">All Categories</option>
                <option value="sports">Sports</option>
                <option value="medical">Medical</option>
                <option value="social">Social</option>
                <option value="seminar">Seminar</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Events Grid */}
          {filteredEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onRegisterClick={handleRegisterClick}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-gray-400 mb-4">
                <Calendar className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No events found
              </h3>
              <p className="text-gray-600">
                Try adjusting your search or filter criteria
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">Barangay Registration System</h3>
              <p className="text-gray-400">
                Simple at secure na paraan para mag-register sa mga barangay events.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">Contact Info</h3>
              <div className="space-y-2 text-gray-400">
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  <span>Barangay Hall, Local Address</span>
                </div>
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  <span>+63 XXX XXX XXXX</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Events</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Barangay Registration System. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;