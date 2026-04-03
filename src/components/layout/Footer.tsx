import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Mail, Phone, MapPin } from 'lucide-react';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="bg-black border-t border-white/5 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
          <div className="col-span-1 md:col-span-1">
            <Logo variant="footer" className="mb-6" />
            <p className="text-white/50 text-sm leading-relaxed mb-6">
              Melbourne's premier chauffeur service, dedicated to providing unparalleled luxury, safety, and punctuality for every journey.
            </p>
            <div className="flex gap-4">
              {[Facebook, Instagram, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-gold hover:text-black transition-all">
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-gold uppercase tracking-widest text-xs font-bold mb-6">Quick Links</h4>
            <ul className="flex flex-col gap-4">
              {['Home', 'Fleet', 'Services', 'About Us', 'Contact', 'Blog'].map((link) => (
                <li key={link}>
                  <Link to={`/${link.toLowerCase().replace(' ', '-')}`} className="text-white/60 hover:text-gold text-sm transition-colors">
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-gold uppercase tracking-widest text-xs font-bold mb-6">Services</h4>
            <ul className="flex flex-col gap-4">
              {['Airport Transfers', 'Corporate Travel', 'Wedding Chauffeur', 'Private Tours', 'Event Transfers', 'Hourly Hire'].map((service) => (
                <li key={service}>
                  <Link to="/services" className="text-white/60 hover:text-gold text-sm transition-colors">
                    {service}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-gold uppercase tracking-widest text-xs font-bold mb-6">Contact Us</h4>
            <ul className="flex flex-col gap-4">
              <li className="flex items-start gap-3 text-white/60 text-sm">
                <MapPin size={18} className="text-gold shrink-0" />
                <span>Collins Street, Melbourne VIC 3000, Australia</span>
              </li>
              <li className="flex items-center gap-3 text-white/60 text-sm">
                <Phone size={18} className="text-gold shrink-0" />
                <span>+61 3 0000 0000</span>
              </li>
              <li className="flex items-center gap-3 text-white/60 text-sm">
                <Mail size={18} className="text-gold shrink-0" />
                <span>bookings@merlux.com.au</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} Merlux Chauffeur Services. All rights reserved.
          </p>
          <div className="flex gap-8">
            <a href="#" className="text-white/30 hover:text-white text-xs transition-colors">Privacy Policy</a>
            <a href="#" className="text-white/30 hover:text-white text-xs transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
