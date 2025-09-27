import React from 'react';
import { Phone, Mail, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';

interface FooterProps {
  className?: string;
}

const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  return (
    <footer id="contact" className={`bg-gray-800 text-white py-12 ${className}`}>
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Contact Info */}
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 via-red-500 to-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">604</span>
              </div>
              <div>
                <h3 className="text-lg font-bold">Barangay 604</h3>
                <p className="text-gray-300 text-sm">Online Registration System</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-blue-400" />
                <span className="text-gray-300">(02) 1234-5678</span>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-blue-400" />
                <span className="text-gray-300">info@barangaysanmiguel.gov.ph</span>
              </div>
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-blue-400 mt-1" />
                <span className="text-gray-300">
                  123 Barangay Road,<br />
                  Bataan St., Manila<br />
                  Philippines 1016
                </span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold mb-4">Quick Links</h3>
            <div className="space-y-2">
              <a href="#events" className="block text-gray-300 hover:text-white transition-colors">Upcoming Events</a>
              <a href="#about" className="block text-gray-300 hover:text-white transition-colors">About Us</a>
              <a href="#contact" className="block text-gray-300 hover:text-white transition-colors">Contact</a>
              <a href="/admin" className="block text-gray-300 hover:text-white transition-colors">Admin Portal</a>
            </div>
          </div>

          {/* Social Media */}
          <div>
            <h3 className="text-lg font-bold mb-4">Follow Us</h3>
            <div className="flex space-x-4">
              <a href="#" className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center hover:bg-pink-700 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-blue-400 rounded-full flex items-center justify-center hover:bg-blue-500 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
            
            <div className="mt-6">
              <h4 className="font-semibold mb-2">Office Hours</h4>
              <p className="text-gray-300 text-sm">
                Monday - Friday: 8:00 AM - 5:00 PM<br />
                Saturday: 8:00 AM - 12:00 PM<br />
                Sunday: Closed
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 text-center">
          <p className="text-gray-400">
            © 2025 Barangay 604 Online Registration System. All rights reserved.
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Developed with ❤️ for the community
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;