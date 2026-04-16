import { ErrorBoundary } from './components/ErrorBoundary';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Booking from './pages/Booking';
import Fleet from './pages/Fleet';
import Services from './pages/Services';
import About from './pages/About';
import Contact from './pages/Contact';
import AppDashboard from './pages/AppDashboard';
import Login from './pages/Login';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import DynamicPage from './pages/DynamicPage';
import Offers from './pages/Offers';
import Tours from './pages/Tours';
import PaymentSuccess from './pages/PaymentSuccess';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import { ChevronDown } from 'lucide-react';

import { SettingsProvider } from './lib/SettingsContext';
import { useState, useEffect } from 'react';

// ✅ ScrollToTopButton with smooth fade
function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-8 right-8 p-4 bg-gold text-black rounded-full shadow-2xl 
                  hover:bg-gold/80 active:bg-gold/60 hover:scale-110 active:scale-95 
                  transition-all z-50 group 
                  transition-opacity duration-500 
                  ${isVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      title="Scroll to Top"
    >
      <ChevronDown
        size={24}
        className="rotate-180 group-hover:-translate-y-1 transition-transform"
      />
    </button>
  );
}

// ✅ AppContent handles routes
function AppContent() {
  const location = useLocation();
  const isDashboard = location.pathname === '/app';

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-gold selection:text-black">
      <Navbar />
      <main className="w-full">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/services" element={<Services />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/tours" element={<Tours />} />
          <Route path="/app" element={<AppDashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          {/* Dynamic SEO Pages */}
          <Route path="/:slug" element={<DynamicPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

// ✅ Main App
export default function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <Router>
          <AppContent />
          <ScrollToTopButton /> {/* Smooth fade scroll-to-top button */}
        </Router>
      </SettingsProvider>
    </ErrorBoundary>
  );
}