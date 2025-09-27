import React from 'react';
import { Calendar, Users, Camera, QrCode } from 'lucide-react';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import EventCarousel from '../components/events/EventCarousel';
import { Event } from '../components/events/EventCard';

const LandingPage: React.FC = () => {
  // Sample events data - will be replaced with API data
  const upcomingEvents: Event[] = [
    {
      id: 1,
      title: "Barangay Basketball Tournament",
      category: "Sports",
      date: "March 15, 2025",
      location: "Barangay Court",
      capacity: "50 players",
      isFeatured: true,
      description: "Annual basketball tournament para sa mga kabataan at adults."
    },
    {
      id: 2,
      title: "Free Medical Check-up",
      category: "Medical",
      date: "March 20, 2025",
      location: "Barangay Hall",
      capacity: "100 residents",
      isFeatured: false,
      description: "Libreng medical check-up para sa lahat ng residents."
    },
    {
      id: 3,
      title: "Community Clean-up Drive",
      category: "Civic",
      date: "March 25, 2025",
      location: "Barangay Streets",
      capacity: "200 volunteers",
      isFeatured: false,
      description: "Sama-sama nating paglinisin ang aming barangay."
    },
    {
      id: 4,
      title: "Digital Literacy Seminar",
      category: "Education",
      date: "March 30, 2025",
      location: "Barangay Hall",
      capacity: "80 participants",
      isFeatured: false,
      description: "Matuto ng basic computer skills at online safety."
    }
  ];

  const handleEventRegister = (eventId: number) => {
    // TODO: Navigate to registration page or open registration modal
    console.log(`Register for event ${eventId}`);
  };

  const handleBrowseEvents = () => {
    // TODO: Navigate to events page or scroll to events section
    document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStartRegistration = () => {
    // TODO: Navigate to registration page
    console.log('Start registration');
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="pt-20 md:pt-24 pb-16 bg-gradient-to-br from-blue-50 via-white to-red-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center min-h-[500px]">
            <div className="lg:w-1/2 text-center lg:text-left mb-8 lg:mb-0">
              <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-4">
                Ang Barangay Mo,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-red-500">
                  Online Na!
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 mb-8 leading-relaxed">
                Mas madali at mabilis na pag-register sa mga events ng barangay. 
                <span className="block mt-2">No more pila, no more hassle!</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button 
                  onClick={handleBrowseEvents}
                  className="bg-gradient-to-r from-blue-600 to-red-500 text-white px-8 py-4 rounded-full text-lg font-semibold hover:shadow-lg transition-all transform hover:scale-105"
                >
                  Browse Events
                </button>
                <button className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-full text-lg font-semibold hover:border-blue-500 hover:text-blue-600 transition-all">
                  Learn More
                </button>
              </div>
            </div>
            
            <div className="lg:w-1/2 flex justify-center">
              <div className="w-80 h-80 bg-gradient-to-br from-blue-100 to-red-100 rounded-3xl flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-600 via-red-500 to-yellow-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <Users className="w-16 h-16 text-white" />
                  </div>
                  <p className="text-gray-700 font-semibold">Barangay Community</p>
                  <p className="text-gray-500 text-sm">Together We Grow</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming Events Preview */}
      <section id="events" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Mga Upcoming Events
            </h2>
            <p className="text-xl text-gray-600">
              Mag-register na para hindi ma-late sa mga exciting events!
            </p>
          </div>

          <EventCarousel 
            events={upcomingEvents} 
            onEventRegister={handleEventRegister}
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Paano Mag-Register?
            </h2>
            <p className="text-xl text-gray-600">
              Tatlong simple steps lang para ma-register sa events!
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Calendar className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">1. Pili ng Event</h3>
              <p className="text-gray-600">
                Browse sa mga available events at piliin kung saan gusto mo sumali.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Camera className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">2. Mag-register</h3>
              <p className="text-gray-600">
                Fill up yung form, take a selfie, at mag-verify ng phone number mo.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <QrCode className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">3. Makakuha ng QR</h3>
              <p className="text-gray-600">
                Download o i-print yung QR code mo para sa event day. Tapos na!
              </p>
            </div>
          </div>

          <div className="text-center mt-12">
            <button 
              onClick={handleStartRegistration}
              className="bg-gradient-to-r from-blue-600 to-red-500 text-white px-8 py-4 rounded-full text-lg font-semibold hover:shadow-lg transition-all transform hover:scale-105"
            >
              Start Registration
            </button>
          </div>
        </div>
      </section>

      {/* About Barangay Section */}
      <section id="about" className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6">
                About Barangay San Miguel
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Ang Barangay San Miguel ay isa sa mga progressive na barangay na nangunguna sa digital transformation. 
                Layunin namin na gawing mas convenient at accessible ang mga serbisyo para sa aming mga residents.
              </p>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Sa pamamagitan ng online registration system na ito, mas madaling makaka-participate ang lahat 
                sa mga community events at programs na naglalayong pag-unlarin ang aming barangay.
              </p>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <h4 className="text-2xl font-bold text-blue-600 mb-2">5,000+</h4>
                  <p className="text-gray-600">Registered Residents</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <h4 className="text-2xl font-bold text-red-600 mb-2">50+</h4>
                  <p className="text-gray-600">Events Organized</p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center">
              <div className="w-96 h-96 bg-gradient-to-br from-blue-100 via-white to-red-100 rounded-3xl flex items-center justify-center">
                <div className="text-center">
                  <div className="w-40 h-40 bg-gradient-to-br from-blue-600 via-red-500 to-yellow-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <Users className="w-20 h-20 text-white" />
                  </div>
                  <p className="text-gray-700 font-semibold text-lg">Community Photo</p>
                  <p className="text-gray-500">Placeholder for Barangay Image</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;