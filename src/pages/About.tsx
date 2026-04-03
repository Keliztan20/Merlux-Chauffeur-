export default function About() {
  return (
    <div className="pt-32 pb-24 bg-black min-h-screen">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center mb-32">
          <div>
            <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">About Merlux</span>
            <h1 className="text-5xl md:text-7xl font-display mb-8">Redefining Luxury Travel</h1>
            <p className="text-white/60 text-lg leading-relaxed mb-6">
              Founded in Melbourne, Merlux Chauffeur Services was born out of a passion for excellence and a commitment to providing the highest standard of professional transport.
            </p>
            <p className="text-white/60 text-lg leading-relaxed">
              We believe that every journey should be more than just a ride—it should be an experience. Our team of professional chauffeurs is dedicated to ensuring your comfort, safety, and punctuality, no matter the destination.
            </p>
          </div>
          <div className="relative">
            <img 
              src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070&auto=format&fit=crop" 
              alt="Chauffeur" 
              className="rounded-sm border border-white/10"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-10 -left-10 bg-gold p-10 hidden md:block">
              <span className="text-black font-display text-6xl block">15+</span>
              <span className="text-black uppercase tracking-widest text-xs font-bold">Years of Excellence</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
