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
import Offers from './pages/Offers';
import Tours from './pages/Tours';
import PaymentSuccess from './pages/PaymentSuccess';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-black text-white font-sans selection:bg-gold selection:text-black">
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/booking" element={<Booking />} />
              <Route path="/fleet" element={<Fleet />} />
              <Route path="/services" element={<Services />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:id" element={<BlogPost />} />
              <Route path="/offers" element={<Offers />} />
              <Route path="/tours" element={<Tours />} />
              <Route path="/app" element={<AppDashboard />} />
              <Route path="/login" element={<Login />} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </ErrorBoundary>
  );
}
