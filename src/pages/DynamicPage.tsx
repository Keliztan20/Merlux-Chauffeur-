import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function DynamicPage() {
  const { slug } = useParams();
  const [pageData, setPageData] = useState<any>(null);
  const [globalCss, setGlobalCss] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'pages'), where('slug', '==', slug), limit(1));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          setPageData(snap.docs[0].data());
          setError(false);
        } else {
          setError(true);
        }

        // Fetch global CSS
        const settingsSnap = await getDoc(doc(db, 'settings', 'cms'));
        if (settingsSnap.exists()) {
          setGlobalCss(settingsSnap.data().globalPageCss || '');
        }
      } catch (err) {
        console.error('Error fetching dynamic page:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchPage();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="text-gold animate-spin" size={40} />
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <div className="min-h-screen bg-black pt-32 px-6 text-center">
        <h1 className="text-4xl font-display mb-6">Page Not Found</h1>
        <p className="text-white/60 mb-8">The luxury experience you're looking for might have moved.</p>
        <Link to="/" className="bg-gold text-black px-8 py-3 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white transition-all">
          Return Home
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
          className="max-w-4xl mx-auto"
        >
          <Link to="/" className="inline-flex items-center gap-2 text-gold text-[10px] uppercase tracking-widest font-bold mb-8 hover:gap-4 transition-all group">
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back Home
          </Link>
          
          <div className="mb-12">
            <h1 className="text-4xl md:text-7xl font-display leading-tight mb-6">
              {pageData.title}
            </h1>
            <div className="h-1 w-24 bg-gold rounded-full" />
          </div>

          {(pageData.featuredImage || pageData.ogImage) && (
            <div className="rounded-[2rem] md:rounded-[3rem] overflow-hidden aspect-[21/9] mb-16 relative group shadow-2xl">
              <img 
                src={pageData.featuredImage || pageData.ogImage} 
                alt={pageData.title} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
          )}

          <div className="cms-content-area prose prose-invert prose-gold max-w-none prose-p:text-white/70 prose-p:leading-relaxed prose-p:text-lg prose-headings:font-display prose-headings:text-white prose-li:text-white/70 prose-img:rounded-3xl prose-img:border prose-img:border-white/10">
            {globalCss && (
              <style dangerouslySetInnerHTML={{ __html: globalCss.replace(/([^\r\n,{}]+)(?=[^{}]*{)/g, '.cms-content-area $1') }} />
            )}
            {pageData.customCss && (
              <style dangerouslySetInnerHTML={{ __html: pageData.customCss.replace(/([^\r\n,{}]+)(?=[^{}]*{)/g, '.cms-content-area $1') }} />
            )}
            <div dangerouslySetInnerHTML={{ __html: pageData.content }} />
          </div>
        </motion.div>
      </article>
    </div>
  );
}
