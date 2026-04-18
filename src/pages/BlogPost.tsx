import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Calendar, User, ArrowLeft, Clock, Share2, Loader2 } from 'lucide-react';

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'blogs'), where('slug', '==', slug), limit(1));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          setPost(snap.docs[0].data());
          setError(false);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error fetching blog post:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchPost();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="text-gold animate-spin" size={40} />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-black pt-32 px-6 text-center">
        <h1 className="text-4xl font-display mb-6">Article Not Found</h1>
        <p className="text-white/60 mb-8">The story you're looking for might have moved.</p>
        <Link to="/blog" className="bg-gold text-black px-8 py-3 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white transition-all">
          Back to Journal
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 bg-black min-h-screen">
      <article className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Link to="/blog" className="inline-flex items-center gap-2 text-gold text-[10px] uppercase tracking-widest font-bold mb-8 hover:gap-4 transition-all">
            <ArrowLeft size={14} /> Back to Journal
          </Link>
          
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-white/40 font-bold mb-6">
            <span className="bg-gold/10 text-gold px-3 py-1 rounded-full">{post.category || 'Luxury Travel'}</span>
            <span className="flex items-center gap-1"><Calendar size={12} /> {post.date || new Date(post.createdAt).toLocaleDateString()}</span>
            <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime || '5 min read'}</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-display leading-tight mb-12">
            {post.title}
          </h1>

          <div className="rounded-[3rem] overflow-hidden aspect-[21/9] mb-16">
            <img 
              src={post.featuredImage || post.image} 
              alt={post.title} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            <div className="lg:col-span-1">
              <div className="sticky top-32 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                    <User size={20} className="text-gold" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-white/40 font-bold">Written by</p>
                    <p className="text-sm font-bold">{post.author || 'Merlux Team'}</p>
                  </div>
                </div>
                <div className="pt-8 border-t border-white/10">
                  <p className="text-[10px] uppercase text-white/40 font-bold mb-4">Share this article</p>
                  <div className="flex gap-4">
                    <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-gold hover:text-black transition-all">
                      <Share2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-3">
              <div 
                className="prose prose-invert prose-gold max-w-none prose-p:text-white/60 prose-p:leading-relaxed prose-headings:font-display prose-headings:text-white prose-li:text-white/60"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            </div>
          </div>
        </motion.div>
      </article>
    </div>
  );
}
