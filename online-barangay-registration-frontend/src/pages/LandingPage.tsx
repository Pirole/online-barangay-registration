// src/pages/LandingPage.tsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Search, Filter, Calendar as CalendarIcon, MapPin, Users, CalendarPlus, FileText, QrCode } from "lucide-react";
import Header from "../components/common/Header";
import Footer from "../components/common/Footer";
import EventCarousel from "../components/events/EventCarousel";
import EventCard from "../components/events/EventCard";
import type { FrontendEvent } from "../components/events/EventCard";
import { useEvents } from "../context/EventContext";

const LandingPage: React.FC = () => {
  const { events, isLoading } = useEvents();
  const eventsSectionRef = useRef<HTMLElement | null>(null);
   useEffect(() => {
    fetch("http://localhost:5000/api/v1/categories")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCategories(data.data.map((c: any) => c.name));
        }
      })
      .catch(err => console.error("Failed to load categories", err));
  }, []);
  const [categories, setCategories] = useState<string[]>([]);

  // We assume `events` is already mapped to FrontendEvent[] by EventContext
  const frontendEvents: FrontendEvent[] = events || [];

  // Featured = first upcoming event (if any)
  const featuredEvent = frontendEvents.length > 0 ? frontendEvents[0] : null;
  const remainingEvents = frontendEvents.slice(1);

  // Filters & search local state (kept minimal here — you can expand later)
  // For now, just wire up the UI controlled inputs (search, category)
  // so we leave the filtering implementation simple and client-side.
  // (You can swap to server-side filters later by using fetchEvents with params.)
  const filteredRemainingEvents = useMemo(() => remainingEvents, [remainingEvents]);

  const scrollToEvents = () => {
    // smooth scroll to events section
    if (eventsSectionRef.current) {
      eventsSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // fallback: anchor fallback
      const el = document.getElementById("events");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleRegisterClick = (eventId: string | number) => {
    // navigate in your app to registration page or open modal
    // for now we just log — you can replace with navigate(`/register/${eventId}`)
    console.log("Register for event:", eventId);
    window.location.href = `/register/${eventId}`; // simple redirect for now
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Header />

      {/* HERO */}
      <section
        aria-label="Hero"
        className="pt-28 pb-24 bg-white min-h-[70vh] flex items-center" // taller hero, vertically centered
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Text */}
            <div className="order-2 md:order-1">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight text-red-500">
                Ang Barangay 604 ay{" "}
                <span className="text-primary-600">Online Na!</span>
              </h1>

              <p className="mt-6 text-xl text-gray-600 max-w-xl">
                Mas mabilis. Mas madali. Mag-register sa barangay events anytime, anywhere.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={scrollToEvents}
                  className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-gradient-to-r from-primary-600 to-primary-400 text-white text-lg font-semibold shadow hover:scale-[1.03] transition-transform"
                >
                  Browse Events
                </button>
              </div>

              <p className="mt-6 text-base text-gray-500">
                <span className="font-medium">Tip:</span> Mag-register na para hindi ma-late!
              </p>
            </div>

            {/* Right side placeholder */}
            <div className="order-1 md:order-2">
              <div className="w-full h-72 sm:h-96 md:h-[28rem] rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 border border-gray-200 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 rounded-full bg-white/80 flex items-center justify-center mx-auto mb-4">
                    <span className="text-primary-600 font-bold text-lg">Logo</span>
                  </div>
                  <p className="text-sm text-gray-500">Barangay image placeholder</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* EVENTS SECTION */}
      <section id="events" ref={eventsSectionRef} className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Heading */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Upcoming Events</h2>
              <p className="text-sm text-gray-600">Browse lahat ng available events sa aming barangay</p>
            </div>

            {/* simple search/filter (non-server) */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center bg-white border border-gray-200 rounded-full px-3 py-2">
                <Search className="w-4 h-4 text-gray-400 mr-2" />
                <input
                  type="search"
                  placeholder="Search events..."
                  className="outline-none text-sm w-48"
                  aria-label="Search events"
                />
              </div>

              <div className="hidden sm:block">
                <select className="px-3 py-2 border border-gray-200 rounded-full bg-white text-sm">
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat.toLowerCase()}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="py-12 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
              <span className="ml-4 text-gray-600">Loading events...</span>
            </div>
          )}

          {/* Featured Event (big card) */}
          {!isLoading && featuredEvent && (
            <div className="mb-8">
              <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3">
                  {/* left: image / placeholder */}
                  <div className="md:col-span-1">
                    <div className="h-48 md:h-full bg-gray-100 flex items-center justify-center">
                      {featuredEvent.imageUrl ? (
                        <img src={featuredEvent.imageUrl} alt={featuredEvent.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <div className="text-center">
                            <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-2">
                              <CalendarPlus className="w-6 h-6 text-primary-600" />
                            </div>
                            <p className="text-sm">Image placeholder</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* right: content */}
                  <div className="md:col-span-2 p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">Featured</span>
                        <h3 className="mt-3 text-2xl font-bold text-gray-900">{featuredEvent.title}</h3>
                        <p className="mt-2 text-sm text-gray-600 line-clamp-3">{featuredEvent.description}</p>

                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-600">
                          <div className="flex items-center">
                            <CalendarIcon className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{featuredEvent.date} • {featuredEvent.time}</span>
                          </div>
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                            <span className="truncate">{featuredEvent.location}</span>
                          </div>
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{featuredEvent.registeredCount} / {featuredEvent.capacity} registered</span>
                          </div>
                        </div>
                      </div>

                      <div className="hidden md:flex md:items-center md:gap-3">
                        <button
                          onClick={() => handleRegisterClick(featuredEvent.id)}
                          className="px-5 py-3 rounded-full bg-primary-600 text-white font-semibold hover:shadow-lg transition"
                        >
                          Register Now
                        </button>
                        <button
                          onClick={() => console.log("View details", featuredEvent.id)}
                          className="px-4 py-2 rounded-full border border-gray-200 text-sm text-gray-700 bg-white hover:bg-gray-50"
                        >
                          View Details
                        </button>
                      </div>
                    </div>

                    {/* mobile actions */}
                    <div className="mt-6 md:hidden flex gap-3">
                      <button
                        onClick={() => handleRegisterClick(featuredEvent.id)}
                        className="flex-1 px-4 py-3 rounded-lg bg-primary-600 text-white font-semibold"
                      >
                        Register Now
                      </button>
                      <button
                        onClick={() => console.log("View details", featuredEvent.id)}
                        className="flex-1 px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Carousel (remaining events) */}
          {!isLoading && (
            <div className="mb-12">
              <EventCarousel
                events={filteredRemainingEvents as any} // cast to match carousel prop type
                onEventRegister={handleRegisterClick}
                autoAdvance={true}
                autoAdvanceInterval={6000}
              />
            </div>
          )}

          {/* No events fallback */}
          {!isLoading && frontendEvents.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              <CalendarIcon className="mx-auto w-12 h-12 mb-4" />
              <h3 className="text-lg font-semibold">Walang naka-schedule na events ngayon</h3>
              <p className="mt-2">Check back later or contact the barangay office for more info.</p>
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section aria-label="How it works" className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold">Paano Mag-register</h2>
            <p className="text-sm text-gray-600 mt-2">Simple lang: Pili ng event, mag-register, at ipakita ang QR sa araw ng activity.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
            <div className="flex flex-col items-center text-center p-6 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mb-4">
                <CalendarIcon className="w-7 h-7 text-primary-600" />
              </div>
              <h4 className="font-semibold">Pili ng Event</h4>
              <p className="text-sm text-gray-600 mt-2">Hanapin ang gusto mong salihan — may categories para madali.</p>
            </div>

            <div className="flex flex-col items-center text-center p-6 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mb-4">
                <FileText className="w-7 h-7 text-primary-600" />
              </div>
              <h4 className="font-semibold">Mag-register</h4>
              <p className="text-sm text-gray-600 mt-2">I-fill up ang form, mag-upload ng photo at i-verify gamit ang OTP.</p>
            </div>

            <div className="flex flex-col items-center text-center p-6 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mb-4">
                <QrCode className="w-7 h-7 text-primary-600" />
              </div>
              <h4 className="font-semibold">Makakuha ng QR</h4>
              <p className="text-sm text-gray-600 mt-2">Idownload ang QR at ipakita sa registration desk sa araw ng event.</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
