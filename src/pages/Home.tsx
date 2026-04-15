import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, ChevronLeft, Star, Shield, Clock, MapPin, 
  Car, Plane, Briefcase, Heart, Wine, Camera, Send, 
  ArrowRight, Calendar, User, Phone, Mail, MessageSquare,
  Map
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useSettings } from '../lib/SettingsContext';

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=2070&auto=format&fit=crop"
];

const SERVICE_OPTIONS = [
  { name: 'Airport Transfer', id: 'airport', icon: Plane },
  { name: 'Corporate Travel', id: 'corporate', icon: Briefcase },
  { name: 'Private Tour', id: 'tour', icon: Map },
  { name: 'Special Event', id: 'wedding', icon: Heart }
];

const FLEET = [
  {
    name: "Mercedes-Benz S-Class",
    type: "First Class",
    passengers: 3,
    luggage: 2,
    img: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?q=80&w=2070&auto=format&fit=crop"
  },
  {
    name: "BMW 7 Series",
    type: "Business Class",
    passengers: 3,
    luggage: 2,
    img: "https://images.unsplash.com/photo-1555215695-3004980ad54e?q=80&w=2070&auto=format&fit=crop"
  },
  {
    name: "Audi A8 L",
    type: "First Class",
    passengers: 3,
    luggage: 2,
    img: "https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?q=80&w=2070&auto=format&fit=crop"
  },
  {
    name: "Mercedes-Benz V-Class",
    type: "Business Van",
    passengers: 7,
    luggage: 5,
    img: "https://images.unsplash.com/photo-1536700503339-1e4b06520771?q=80&w=2070&auto=format&fit=crop"
  }
];

const BLOGS = [
  {
    id: 1,
    title: "The Ultimate Guide to Melbourne Airport Transfers",
    date: "March 28, 2026",
    category: "Travel Tips",
    img: "https://images.unsplash.com/photo-1436491865332-7a61a109c0f3?q=80&w=2070&auto=format&fit=crop"
  },
  {
    id: 2,
    title: "Why Corporate Travel Demands a Chauffeur Service",
    date: "March 24, 2026",
    category: "Business",
    img: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"
  },
  {
    id: 3,
    title: "Planning Your Dream Wedding: The Role of Luxury Transport",
    date: "March 20, 2026",
    category: "Weddings",
    img: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop"
  }
];

export default function Home() {
  const { settings } = useSettings();
  const contact = settings?.contact || {
    address: 'Collins Street, Melbourne VIC 3000, Australia',
    phone: '+61 3 9000 0000',
    email: 'bookings@merlux.com.au',
    bookingEmail: 'bookings@merlux.com.au'
  };

  const navigate = useNavigate();
  const [currentHero, setCurrentHero] = useState(0);
  const [currentFleet, setCurrentFleet] = useState(0);
  const [selectedService, setSelectedService] = useState('airport');
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Hero Slider logic
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHero((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleContactSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      setContactForm({ name: '', email: '', message: '' });
      setTimeout(() => setSubmitted(false), 5000);
    }, 1500);
  };

  return (
    <div className="relative bg-black text-white overflow-x-hidden">
      {/* 1. Hero Section with Image Slider */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentHero}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 0.6, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0 z-0"
          >
            <img
              src={HERO_IMAGES[currentHero]}
              alt="Luxury Chauffeur"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black z-[1]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-gold uppercase tracking-[0.5em] text-xs font-bold mb-6 block">Premium Chauffeur Service</span>
            <h1 className="text-5xl md:text-8xl font-display mb-8 leading-tight">
              Elegance in <span className="text-gold italic">Every Mile</span>
            </h1>
            <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-12 font-light tracking-wide leading-relaxed">
              Experience Melbourne's most refined transport service. From airport transfers to bespoke private tours, we redefine luxury travel.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              <Link to="/booking" className="bg-gold text-black px-10 py-5 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white transition-all duration-500 flex items-center gap-3 group">
                Book Your Journey <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
              </Link>
              <Link to="/fleet" className="bg-white/5 border border-white/10 backdrop-blur-md text-white px-10 py-5 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-all duration-500">
                Explore Our Fleet
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Hero Controls */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex gap-4">
          {HERO_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentHero(i)}
              className={cn(
                "w-12 h-1 bg-white/20 transition-all duration-500",
                currentHero === i && "bg-gold w-20"
              )}
            />
          ))}
        </div>
      </section>

      {/* 2. Quick Offers & Tours Grid */}
      <section className="py-24 bg-black relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Offers Card */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="group relative h-[500px] rounded-[3rem] overflow-hidden border border-white/10"
            >
              <img 
                src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop" 
                alt="Offers"
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-60"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute bottom-12 left-12 right-12">
                <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Limited Time</span>
                <h2 className="text-4xl md:text-5xl font-display mb-6">Exclusive <span className="text-gold italic">Offers</span></h2>
                <p className="text-white/60 mb-8 max-w-md">
                  Premium airport transfers at competitive fixed rates. Experience luxury for less with our curated seasonal packages.
                </p>
                <Link to="/offers" className="bg-gold text-black px-8 py-4 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-all duration-500">View All Offers</Link>
              </div>
            </motion.div>

            {/* Tours Card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="group relative h-[500px] rounded-[3rem] overflow-hidden border border-white/10"
            >
              <img 
                src="https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?q=80&w=2070&auto=format&fit=crop" 
                alt="Tours"
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-60"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute bottom-12 left-12 right-12">
                <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Bespoke Experiences</span>
                <h2 className="text-4xl md:text-5xl font-display mb-6">Private <span className="text-gold italic">Tours</span></h2>
                <p className="text-white/60 mb-8 max-w-md">
                  Discover Victoria's most iconic destinations in absolute comfort. Tailored itineraries for the discerning traveler.
                </p>
                <Link to="/tours" className="bg-gold text-black px-8 py-4 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-all duration-500">Explore Tours</Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. Booking First Step & Guide */}
      <section className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Step 01</span>
              <h2 className="text-4xl md:text-6xl font-display mb-8">Start Your <span className="text-gold italic">Reservation</span></h2>
              <p className="text-white/60 mb-10 leading-relaxed text-lg">
                Begin your luxury experience by selecting your service type. Whether it's a quick airport transfer or a full-day private tour, we've got you covered.
              </p>
              
              <div className="bg-white/5 border border-white/10 p-8 md:p-10 rounded-[2.5rem] backdrop-blur-xl relative group/booking hover:border-gold/30 transition-all duration-700">
                <div className="absolute -inset-1 bg-gradient-to-r from-gold/20 to-transparent blur-2xl opacity-0 group-hover/booking:opacity-100 transition-opacity duration-1000" />
                <div className="relative z-10">
                  <div className="mb-10">
                    <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-gold mb-6 block">Select Your Service</label>
                    <div className="grid grid-cols-2 gap-4">
                      {SERVICE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setSelectedService(option.id)}
                          className={cn(
                            "flex flex-col items-center justify-center p-6 rounded-2xl border transition-all duration-500 gap-4 group/opt relative overflow-hidden",
                            selectedService === option.id 
                              ? "bg-gold border-gold text-black shadow-lg shadow-gold/20" 
                              : "bg-white/5 border-white/10 text-white hover:border-gold/50"
                          )}
                        >
                          {selectedService === option.id && (
                            <motion.div 
                              layoutId="activeGlow"
                              className="absolute inset-0 bg-white/20 blur-xl"
                            />
                          )}
                          <div className="relative z-10 flex flex-col items-center gap-3">
                            <option.icon 
                              size={24} 
                              className={cn(
                                "transition-all duration-500 group-hover/opt:scale-110",
                                selectedService === option.id ? "text-black" : "text-gold"
                              )} 
                            />
                            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-center leading-tight">
                              {option.name}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/booking', { state: { service: selectedService, step: 2 } })}
                    className="w-full bg-gold text-black py-5 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-white transition-all duration-500 shadow-2xl shadow-gold/20 flex items-center justify-center gap-3 group"
                  >
                    Continue to Details <ArrowRight size={14} className="group-hover:translate-x-2 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>

            <div className="space-y-12">
              {[
                { step: '01', title: 'Choose Service', desc: 'Select from airport transfers, corporate, or private tours.' },
                { step: '02', title: 'Select Vehicle', desc: 'Pick the perfect luxury car from our premium fleet.' },
                { step: '03', title: 'Confirm & Pay', desc: 'Secure your booking with our easy online payment.' },
                { step: '04', title: 'Enjoy the Ride', desc: 'Your professional chauffeur arrives on time, every time.' }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-8 group"
                >
                  <div className="text-gold font-display text-4xl opacity-20 group-hover:opacity-100 transition-opacity duration-500">{item.step}</div>
                  <div>
                    <h3 className="text-xl font-display mb-2">{item.title}</h3>
                    <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Our Services */}
      <section className="py-24 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Excellence in Motion</span>
            <h2 className="text-4xl md:text-6xl font-display">Our Bespoke <span className="text-gold italic">Services</span></h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Plane, title: 'Airport Transfers', desc: 'Reliable transfers to Tullamarine & Avalon with flight tracking.' },
              { icon: Briefcase, title: 'Corporate Travel', desc: 'Professional chauffeur service for executives and business events.' },
              { icon: Wine, title: 'Private Tours', desc: 'Customized tours to Yarra Valley, Great Ocean Road, and more.' },
              { icon: Heart, title: 'Wedding Service', desc: 'Elegant transport for your special day with premium vehicles.' },
              { icon: Camera, title: 'Special Events', desc: 'Arrive in style at galas, concerts, and sporting events.' },
              { icon: Shield, title: 'VIP Protection', desc: 'Discreet and secure transport for high-profile individuals.' }
            ].map((service, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-10 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-gold group transition-all duration-500 cursor-pointer"
              >
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-black transition-colors">
                  <service.icon className="text-gold" size={32} />
                </div>
                <h3 className="text-2xl font-display mb-4 group-hover:text-black transition-colors">{service.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed mb-8 group-hover:text-black/70 transition-colors">{service.desc}</p>
                <Link to="/booking" className="flex items-center gap-2 text-gold group-hover:text-black font-bold uppercase tracking-widest text-[10px] transition-colors">
                  Book Service <ChevronRight size={14} />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Short Contact Form */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-gold rounded-[3rem] p-12 md:p-20 text-black grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-6xl font-display mb-6">Get in <span className="italic">Touch</span></h2>
              <p className="text-black/70 mb-10 text-lg leading-relaxed">
                Have a special request or need a custom quote? Our concierge team is available 24/7 to assist you.
              </p>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-black/10 rounded-full flex items-center justify-center">
                    <Phone size={20} />
                  </div>
                  <p className="font-bold">{contact.phone}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-black/10 rounded-full flex items-center justify-center">
                    <Mail size={20} />
                  </div>
                  <p className="font-bold">{contact.bookingEmail || contact.email}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleContactSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" size={18} />
                  <input 
                    type="text" 
                    placeholder="Your Name" 
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({...contactForm, name: e.target.value})}
                    className="w-full bg-white/20 border border-black/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-black outline-none transition-all placeholder:text-black/40"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40" size={18} />
                  <input 
                    type="email" 
                    placeholder="Your Email" 
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                    className="w-full bg-white/20 border border-black/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-black outline-none transition-all placeholder:text-black/40"
                  />
                </div>
              </div>
              <div className="relative">
                <MessageSquare className="absolute left-4 top-6 text-black/40" size={18} />
                <textarea 
                  placeholder="Your Message" 
                  rows={4}
                  required
                  value={contactForm.message}
                  onChange={(e) => setContactForm({...contactForm, message: e.target.value})}
                  className="w-full bg-white/20 border border-black/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-black focus:border-black outline-none transition-all placeholder:text-black/40 resize-none"
                />
              </div>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-black text-white py-5 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3"
              >
                {isSubmitting ? <Clock className="animate-spin" size={18} /> : (submitted ? "Message Sent!" : "Send Message")}
                {!isSubmitting && !submitted && <Send size={16} />}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* 5. Our Fleet Carousel */}
      <section className="py-24 bg-black overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div>
              <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">The Collection</span>
              <h2 className="text-4xl md:text-6xl font-display">Our Luxury <span className="text-gold italic">Fleet</span></h2>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setCurrentFleet((prev) => (prev - 1 + FLEET.length) % FLEET.length)}
                className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center hover:bg-gold hover:text-black transition-all"
              >
                <ChevronLeft size={24} />
              </button>
              <button 
                onClick={() => setCurrentFleet((prev) => (prev + 1) % FLEET.length)}
                className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center hover:bg-gold hover:text-black transition-all"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>

          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentFleet}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
              >
                <div className="rounded-[3rem] overflow-hidden h-[400px] md:h-[500px]">
                  <img 
                    src={FLEET[currentFleet].img} 
                    alt={FLEET[currentFleet].name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-8">
                  <span className="text-gold uppercase tracking-widest text-xs font-bold mb-4 block">{FLEET[currentFleet].type}</span>
                  <h3 className="text-4xl md:text-6xl font-display mb-8">{FLEET[currentFleet].name}</h3>
                  <div className="grid grid-cols-2 gap-8 mb-12">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                        <User className="text-gold" size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-white/40 font-bold">Passengers</p>
                        <p className="text-lg font-bold">{FLEET[currentFleet].passengers}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                        <Briefcase className="text-gold" size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-white/40 font-bold">Luggage</p>
                        <p className="text-lg font-bold">{FLEET[currentFleet].luggage}</p>
                      </div>
                    </div>
                  </div>
                  <Link to="/fleet" className="btn-primary inline-flex">View Fleet Details</Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* 6. Latest Blogs */}
      <section className="py-24 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div>
              <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Insights</span>
              <h2 className="text-4xl md:text-6xl font-display">Latest <span className="text-gold italic">Blogs</span></h2>
            </div>
            <Link to="/blog" className="text-gold text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 hover:gap-4 transition-all">
              View All Articles <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {BLOGS.map((blog, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group cursor-pointer"
                onClick={() => navigate(`/blog/${blog.id}`)}
              >
                <div className="rounded-[2.5rem] overflow-hidden h-72 mb-8 relative">
                  <img 
                    src={blog.img} 
                    alt={blog.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-6 left-6 bg-gold text-black px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    {blog.category}
                  </div>
                </div>
                <p className="text-gold text-[10px] uppercase tracking-widest font-bold mb-3">{blog.date}</p>
                <h3 className="text-2xl font-display mb-4 group-hover:text-gold transition-colors">{blog.title}</h3>
                <div className="flex items-center gap-2 text-white/40 uppercase tracking-widest text-[10px] font-bold group-hover:text-white transition-colors">
                  Read Article <ArrowRight size={14} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Last Tour Chauffeur Transfers */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-30">
          <img 
            src="https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?q=80&w=2070&auto=format&fit=crop" 
            alt="Tour Background"
            className="w-full h-full object-cover grayscale"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="max-w-2xl">
            <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Featured Experience</span>
            <h2 className="text-4xl md:text-7xl font-display mb-8 leading-tight">Private <span className="text-gold italic">Tour</span> Transfers</h2>
            <p className="text-white/60 mb-12 text-lg leading-relaxed">
              Discover Victoria's most iconic destinations in absolute comfort. Our chauffeurs are local experts who will guide you through the Great Ocean Road, Yarra Valley, or Phillip Island with a personalized itinerary.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-12">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gold/10 rounded-2xl flex items-center justify-center border border-gold/20">
                  <Map size={24} className="text-gold" />
                </div>
                <div>
                  <h4 className="font-display text-xl">Custom Routes</h4>
                  <p className="text-white/40 text-xs">Tailored to your pace</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gold/10 rounded-2xl flex items-center justify-center border border-gold/20">
                  <Clock size={24} className="text-gold" />
                </div>
                <div>
                  <h4 className="font-display text-xl">Full Day Hire</h4>
                  <p className="text-white/40 text-xs">8-12 hour packages</p>
                </div>
              </div>
            </div>

            <Link to="/booking" className="btn-primary inline-flex">Book a Private Tour</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
