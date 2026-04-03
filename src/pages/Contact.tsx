import { Mail, Phone, MapPin, Send } from 'lucide-react';

export default function Contact() {
  return (
    <div className="pt-32 pb-24 bg-black min-h-screen">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Contact Us</span>
          <h1 className="text-5xl md:text-7xl font-display mb-6">Get In Touch</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-1 space-y-8">
            <div className="glass p-8">
              <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center mb-6">
                <Phone className="text-gold" size={24} />
              </div>
              <h3 className="text-xl font-display mb-2">Call Us</h3>
              <p className="text-white/50 text-sm mb-4">Available 24/7 for bookings and inquiries.</p>
              <a href="tel:+61300000000" className="text-gold font-bold text-lg">+61 3 0000 0000</a>
            </div>

            <div className="glass p-8">
              <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center mb-6">
                <Mail className="text-gold" size={24} />
              </div>
              <h3 className="text-xl font-display mb-2">Email Us</h3>
              <p className="text-white/50 text-sm mb-4">We'll get back to you within 2 hours.</p>
              <a href="mailto:bookings@merlux.com.au" className="text-gold font-bold text-lg">bookings@merlux.com.au</a>
            </div>

            <div className="glass p-8">
              <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center mb-6">
                <MapPin className="text-gold" size={24} />
              </div>
              <h3 className="text-xl font-display mb-2">Our Office</h3>
              <p className="text-white/50 text-sm mb-4">Visit us at our Melbourne headquarters.</p>
              <p className="text-white font-bold">Collins Street, Melbourne VIC 3000</p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <form className="glass p-10 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-gold font-bold">Full Name</label>
                  <input type="text" className="w-full bg-white/5 border border-white/10 py-4 px-4 focus:border-gold outline-none transition-all" placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-gold font-bold">Email Address</label>
                  <input type="email" className="w-full bg-white/5 border border-white/10 py-4 px-4 focus:border-gold outline-none transition-all" placeholder="john@example.com" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-gold font-bold">Subject</label>
                <input type="text" className="w-full bg-white/5 border border-white/10 py-4 px-4 focus:border-gold outline-none transition-all" placeholder="Inquiry about Corporate Travel" />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-gold font-bold">Message</label>
                <textarea rows={6} className="w-full bg-white/5 border border-white/10 py-4 px-4 focus:border-gold outline-none transition-all resize-none" placeholder="How can we help you?"></textarea>
              </div>
              <button className="btn-primary w-full flex items-center justify-center gap-3 py-4">
                Send Message <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
