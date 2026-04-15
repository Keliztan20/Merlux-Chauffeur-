import { Link } from 'react-router-dom';

export default function Services() {
  return (
    <div className="pt-32 pb-24 bg-black min-h-screen">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Premium Services</span>
          <h1 className="text-5xl md:text-7xl font-display mb-6">Luxury Travel Solutions</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {[
            {
              title: 'Airport Transfers',
              slug: 'airport-transfers',
              desc: 'Reliable and luxurious transfers to and from Melbourne Airport (Tullamarine) and Avalon Airport. We monitor your flight status in real-time to ensure your chauffeur is waiting for you upon arrival.',
              img: 'https://images.unsplash.com/photo-1436491865332-7a61a109c0f2?q=80&w=2070&auto=format&fit=crop'
            },
            {
              title: 'Corporate Travel',
              slug: 'corporate-travel',
              desc: 'Professional chauffeur services for busy executives. Arrive at your meetings refreshed and prepared. Our chauffeurs understand the importance of discretion and punctuality.',
              img: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=2071&auto=format&fit=crop'
            },
            {
              title: 'Wedding Chauffeur',
              slug: 'wedding-chauffeur',
              desc: 'Add a touch of elegance to your special day. Our pristine luxury vehicles and professional chauffeurs ensure you arrive in style and comfort.',
              img: 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop'
            },
            {
              title: 'Private Tours',
              slug: 'private-tours',
              desc: 'Explore the beauty of Victoria with our bespoke private tours. From the Great Ocean Road to the Yarra Valley wineries, we create custom itineraries tailored to your interests.',
              img: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?q=80&w=2070&auto=format&fit=crop'
            }
          ].map((service, i) => (
            <div key={i} className="glass group overflow-hidden">
              <div className="h-80 overflow-hidden">
                <img 
                  src={service.img} 
                  alt={service.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-10">
                <h3 className="text-3xl font-display mb-4">{service.title}</h3>
                <p className="text-white/60 leading-relaxed mb-8">{service.desc}</p>
                <Link to={`/${service.slug}`} className="btn-outline inline-block">Learn More</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
