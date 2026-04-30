import { ErrorBoundary } from './components/ErrorBoundary';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import FloatingElements from './components/FloatingElements';

import { useSettings, SettingsProvider } from './lib/SettingsContext';
import { cn } from './lib/utils';

function AppLayout() {
  const { floatingSettings } = useSettings();
  const barPosition = floatingSettings?.bar?.position || 'top';

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-gold selection:text-black flex flex-col">
      <FloatingElements />
      <header className="sticky top-0 z-50 w-full pointer-events-none">
        <div className="pointer-events-auto">
          <Navbar />
        </div>
      </header>
      <main className="flex-1">
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

export default function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <Router>
          <AppLayout />
        </Router>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
