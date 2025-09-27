import React, { useState, useEffect } from 'react';

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className = '' }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Handle scroll effect for header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed w-full top-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white shadow-md py-2' : 'bg-white/90 backdrop-blur-sm py-4'
    } ${className}`}>
      <nav className="container mx-auto px-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 via-red-500 to-yellow-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">BRG</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold text-gray-800">Barangay San Miguel</h1>
            <p className="text-xs text-gray-600">Online Registration System</p>
          </div>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center space-x-6">
          <a href="#events" className="text-gray-700 hover:text-blue-600 transition-colors">Events</a>
          <a href="#about" className="text-gray-700 hover:text-blue-600 transition-colors">About</a>
          <a href="#contact" className="text-gray-700 hover:text-blue-600 transition-colors">Contact</a>
          <button className="bg-gradient-to-r from-blue-600 to-red-500 text-white px-6 py-2 rounded-full hover:shadow-lg transition-all transform hover:scale-105">
            Register for Events
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <div className="w-6 h-0.5 bg-gray-600 mb-1"></div>
          <div className="w-6 h-0.5 bg-gray-600 mb-1"></div>
          <div className="w-6 h-0.5 bg-gray-600"></div>
        </button>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t shadow-lg">
          <div className="container mx-auto px-4 py-4 space-y-4">
            <a href="#events" className="block text-gray-700 hover:text-blue-600">Events</a>
            <a href="#about" className="block text-gray-700 hover:text-blue-600">About</a>
            <a href="#contact" className="block text-gray-700 hover:text-blue-600">Contact</a>
            <button className="w-full bg-gradient-to-r from-blue-600 to-red-500 text-white py-3 rounded-full">
              Register for Events
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;