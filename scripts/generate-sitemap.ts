import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

let SITE_URL = process.env.VITE_SITE_URL || 'https://merlux.au';
if (!SITE_URL.startsWith('http')) {
  SITE_URL = `https://${SITE_URL}`;
}
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const DIST_DIR = path.join(process.cwd(), 'dist');

// Load Firebase config from firebase-applet-config.json
let firebaseConfig: any;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.error('⚠️ Could not load firebase-applet-config.json:', err);
}

if (!firebaseConfig) {
  console.error('❌ Firebase configuration not found. Cannot generate sitemap.');
  process.exit(1);
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId;

  console.log(`Initializing Firebase Admin for project: ${projectId}, database: ${databaseId || '(default)'}`);
  
  delete process.env.FIREBASE_CONFIG;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  
  admin.initializeApp({
    projectId: projectId,
  });

  if (databaseId) {
    admin.firestore().settings({ databaseId });
  }
}

const db = admin.firestore();

const STATIC_PAGES = [
  { title: 'Home', slug: '', path: '/' },
  { title: 'Offers', slug: 'offers', path: '/offers' },
  { title: 'Tours', slug: 'tours', path: '/tours' },
  { title: 'Services', slug: 'services', path: '/services' },
  { title: 'Blog', slug: 'blog', path: '/blog' },
  { title: 'Fleet', slug: 'fleet', path: '/fleet' },
  { title: 'About', slug: 'about', path: '/about' },
  { title: 'Contact', slug: 'contact', path: '/contact' },
  { title: 'Faq', slug: 'faq', path: '/faq' },
];

const getRouteSlug = (item: any) => {
  if (item.type === 'Page') {
    return item.slug || 'home';
  } else if (item.type === 'Blog') {
    return `blog/${item.slug}`;
  } else if (item.type === 'Offer') {
    return `offers/${item.slug}`;
  } else if (item.type === 'Tour') {
    return `tours/${item.slug}`;
  }
  return item.slug || '';
};

const getFullPath = (item: any) => {
  const routeSlug = getRouteSlug(item);
  if (routeSlug === 'home') return '/';
  return `/${routeSlug}`;
};

const formatDate = (val: any): string => {
  if (!val) return new Date().toISOString().split('T')[0];
  try {
    let d: Date;
    if (val.seconds !== undefined) {
      d = new Date(val.seconds * 1000);
    } else if (val._seconds !== undefined) {
      d = new Date(val._seconds * 1000);
    } else if (val.toDate && typeof val.toDate === 'function') {
      d = val.toDate();
    } else {
      d = new Date(val);
    }
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {}
  return new Date().toISOString().split('T')[0];
};

// Scalable helper to stream collections in batch segments to optimize memory using Admin SDK
async function* streamCollection(collectionName: string, batchSize = 100) {
  let queryRef = db.collection(collectionName).limit(batchSize);
  let lastDoc: any = null;
  let hasMore = true;

  while (hasMore) {
    let currentQuery = lastDoc ? queryRef.startAfter(lastDoc) : queryRef;
    const snap = await currentQuery.get();
    if (snap.empty) {
      hasMore = false;
      break;
    }
    yield snap.docs;
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < batchSize) {
      hasMore = false;
    }
  }
}

interface SitemapHtmlEntry {
  url: string;
  path: string;
  lastmod: string;
  changefreq: string;
  priority: string;
  category: 'page' | 'blog' | 'offer' | 'tour';
  title: string;
  isStatic?: boolean;
}

const sitemapHtmlEntries: SitemapHtmlEntry[] = [];

const prettifyTitle = (pathStr: string, currentTitle: string = ''): string => {
  const fallback = currentTitle || '';
  if (fallback && fallback !== 'Special Offer' && fallback !== 'Tour' && fallback !== 'Special VIP Promotions' && fallback !== 'Hotel & Long Stay') {
    return fallback;
  }
  const lastSection = pathStr.split('/').filter(Boolean).pop() || 'Home';
  return lastSection
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

async function generateSitemap() {
  console.log('🚀 Starting Scalable Admin Multiple Sitemap & HTML Generation matches MetaTab.tsx rules...');

  try {
    if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

    const pageTempPath = path.join(PUBLIC_DIR, 'page-sitemap.xml.tmp');
    const blogTempPath = path.join(PUBLIC_DIR, 'blog-sitemap.xml.tmp');
    const offerTempPath = path.join(PUBLIC_DIR, 'offer-sitemap.xml.tmp');
    const toursTempPath = path.join(PUBLIC_DIR, 'tours-sitemap.xml.tmp');

    const pageStream = fs.createWriteStream(pageTempPath, { encoding: 'utf8' });
    const blogStream = fs.createWriteStream(blogTempPath, { encoding: 'utf8' });
    const offerStream = fs.createWriteStream(offerTempPath, { encoding: 'utf8' });
    const toursStream = fs.createWriteStream(toursTempPath, { encoding: 'utf8' });

    const writeHeader = (stream: fs.WriteStream) => {
      stream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
      stream.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');
    };

    writeHeader(pageStream);
    writeHeader(blogStream);
    writeHeader(offerStream);
    writeHeader(toursStream);

    let maxLastmodPage = formatDate(null);
    let maxLastmodBlog = formatDate(null);
    let maxLastmodOffer = formatDate(null);
    let maxLastmodTour = formatDate(null);

    const writeUrlEntryWithTracking = (
      stream: fs.WriteStream, 
      path: string, 
      lastmod: string, 
      changefreq: string, 
      priority: string,
      category: 'page' | 'blog' | 'offer' | 'tour',
      docTitle: string,
      isStaticFlag = false
    ) => {
      stream.write(`  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>\n`);

      sitemapHtmlEntries.push({
        url: `${SITE_URL}${path}`,
        path: path,
        lastmod,
        changefreq,
        priority,
        category,
        title: prettifyTitle(path, docTitle),
        isStatic: isStaticFlag
      });

      if (category === 'page') {
        maxLastmodPage = lastmod > maxLastmodPage ? lastmod : maxLastmodPage;
      } else if (category === 'blog') {
        maxLastmodBlog = lastmod > maxLastmodBlog ? lastmod : maxLastmodBlog;
      } else if (category === 'offer') {
        maxLastmodOffer = lastmod > maxLastmodOffer ? lastmod : maxLastmodOffer;
      } else if (category === 'tour') {
        maxLastmodTour = lastmod > maxLastmodTour ? lastmod : maxLastmodTour;
      }
    };

    // 1. Accumulate metadata overrides in an Administrative Map
    console.log('📦 Loading database metadata overrides incrementally...');
    const metadataMap = new Map<string, { noindex?: boolean; updatedAt?: any }>();
    try {
      for await (const docs of streamCollection('metadata', 200)) {
        (docs as any[]).forEach((doc: any) => {
          const data = doc.data() as any;
          const slugVal = (data.slug || '').toLowerCase();
          const idVal = doc.id.toLowerCase();
          const record = {
            noindex: data.noindex,
            updatedAt: data.updatedAt
          };
          if (slugVal) {
            metadataMap.set(slugVal, record);
          }
          if (idVal) {
            metadataMap.set(idVal, record);
          }
        });
      }
      console.log(`✅ Loaded ${metadataMap.size} database metadata records.`);
    } catch (dbErr) {
      console.warn('⚠️ Could not fetch metadata overrides, continuing with defaults:', dbErr);
    }

    const getMetadataOverride = (routeSlug: string) => {
      const normSlug = (routeSlug || '').toLowerCase();
      const replaced = normSlug.replace(/\//g, '_');
      let override = metadataMap.get(normSlug);
      if (!override && replaced) {
        override = metadataMap.get(replaced);
      }
      return override;
    };

    // Tracking for static pages and already processed paths to guarantee uniqueness
    interface StaticPageStatus {
      isCovered: boolean;
      noindex?: boolean;
      updatedAt?: any;
      createdAt?: any;
    }

    const staticPagesStatus = new Map<string, StaticPageStatus>();
    STATIC_PAGES.forEach(sp => {
      staticPagesStatus.set(sp.slug.toLowerCase(), {
        isCovered: false,
        noindex: false,
        updatedAt: null,
        createdAt: null
      });
    });

    const registeredPaths = new Set<string>();

    // 2. Stream and process the Dynamic 'pages' collection
    console.log('📄 Processing dynamic pages from database...');
    try {
      for await (const docs of streamCollection('pages', 100)) {
        (docs as any[]).forEach((doc: any) => {
          const p = { id: doc.id, type: 'Page', ...(doc.data() as any) } as any;
          const slugKey = (p.slug || '').toLowerCase();
          const routeSlug = p.slug || 'home';
          const docOverride = getMetadataOverride(routeSlug);
          const noindex = p.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (p.noindex || false));
          const active = p.active !== false;
          const updatedAt = docOverride?.updatedAt || p.updatedAt || p.createdAt || null;
          const createdAt = p.createdAt || null;

          // If this page covers a static system route, record it to merge at the end
          if (staticPagesStatus.has(slugKey)) {
            staticPagesStatus.set(slugKey, {
              isCovered: true,
              noindex,
              updatedAt,
              createdAt
            });
          } else {
            // If purely custom dynamic page, write it immediately
            const cleanPath = getFullPath(p);
            if (!registeredPaths.has(cleanPath)) {
              registeredPaths.add(cleanPath);
              if (!noindex && active) {
                const lastmod = formatDate(updatedAt || createdAt);
                writeUrlEntryWithTracking(pageStream, cleanPath, lastmod, cleanPath === '/' ? 'daily' : 'weekly', cleanPath === '/' ? '1.0' : '0.8', 'page', p.title);
              }
            }
          }
        });
      }
    } catch (e: any) {
      console.warn('⚠️ Pages collection stream failed or empty:', e.message);
    }

    // 3. Stream 'blogs' collection
    console.log('✍️ Processing blog posts from database...');
    try {
      for await (const docs of streamCollection('blogs', 100)) {
        (docs as any[]).forEach((doc: any) => {
          const b = { id: doc.id, type: 'Blog', ...(doc.data() as any) } as any;
          const routeSlug = `blog/${b.slug}`;
          const docOverride = getMetadataOverride(routeSlug);
          const noindex = b.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (b.noindex || false));
          const active = b.active !== false;
          const updatedAt = docOverride?.updatedAt || b.updatedAt || b.createdAt || null;
          const createdAt = b.createdAt || null;

          const cleanPath = getFullPath(b);
          if (!registeredPaths.has(cleanPath)) {
            registeredPaths.add(cleanPath);
            if (!noindex && active) {
              const lastmod = formatDate(updatedAt || createdAt);
              writeUrlEntryWithTracking(blogStream, cleanPath, lastmod, 'weekly', '0.8', 'blog', b.title);
            }
          }
        });
      }
    } catch (e: any) {
      console.warn('⚠️ Blogs collection stream failed or empty:', e.message);
    }

    // 4. Stream 'offers' collection
    console.log('🏷️ Processing promo offers from database...');
    try {
      for await (const docs of streamCollection('offers', 100)) {
        (docs as any[]).forEach((doc: any) => {
          const o = { id: doc.id, type: 'Offer', ...(doc.data() as any) } as any;
          const routeSlug = `offers/${o.slug}`;
          const docOverride = getMetadataOverride(routeSlug);
          const noindex = o.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (o.noindex || false));
          const active = o.active !== false;
          const updatedAt = docOverride?.updatedAt || o.updatedAt || o.createdAt || null;
          const createdAt = o.createdAt || null;

          const cleanPath = getFullPath(o);
          if (!registeredPaths.has(cleanPath)) {
            registeredPaths.add(cleanPath);
            if (!noindex && active) {
              const lastmod = formatDate(updatedAt || createdAt);
              writeUrlEntryWithTracking(offerStream, cleanPath, lastmod, 'weekly', '0.8', 'offer', o.title || o.name);
            }
          }
        });
      }
    } catch (e: any) {
      console.warn('⚠️ Offers collection stream failed or empty:', e.message);
    }

    // 5. Stream 'tours' collection
    console.log('🗺️ Processing private tours from database...');
    try {
      for await (const docs of streamCollection('tours', 100)) {
        (docs as any[]).forEach((doc: any) => {
          const t = { id: doc.id, type: 'Tour', ...(doc.data() as any) } as any;
          const routeSlug = `tours/${t.slug}`;
          const docOverride = getMetadataOverride(routeSlug);
          const noindex = t.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (t.noindex || false));
          const active = t.active !== false;
          const updatedAt = docOverride?.updatedAt || t.updatedAt || t.createdAt || null;
          const createdAt = t.createdAt || null;

          const cleanPath = getFullPath(t);
          if (!registeredPaths.has(cleanPath)) {
            registeredPaths.add(cleanPath);
            if (!noindex && active) {
              const lastmod = formatDate(updatedAt || createdAt);
              writeUrlEntryWithTracking(toursStream, cleanPath, lastmod, 'weekly', '0.8', 'tour', t.title || t.name);
            }
          }
        });
      }
    } catch (e: any) {
      console.warn('⚠️ Tours collection stream failed or empty:', e.message);
    }

    // 6. Process and append STATIC_PAGES with correct merges
    console.log('⚙️ Appending processed static system pages...');
    STATIC_PAGES.forEach((page: any) => {
      const slugKey = page.slug.toLowerCase();
      const status = staticPagesStatus.get(slugKey);
      
      let noindex = false;
      let updatedAt = null;
      let createdAt = null;

      if (status) {
        if (status.isCovered) {
          if (status.noindex) return; // ignore static page if it is marked as noindex via the covering page
          updatedAt = status.updatedAt;
          createdAt = status.createdAt;
        } else {
          // If uncovered virtual static page, see metadata override
          const routeSlug = page.slug || 'home';
          const docOverride = getMetadataOverride(routeSlug);
          if (docOverride?.noindex === true) return;
          updatedAt = docOverride?.updatedAt || null;
        }
      }

      const cleanPath = page.path || '/';
      if (!registeredPaths.has(cleanPath)) {
        registeredPaths.add(cleanPath);
        const lastmod = formatDate(updatedAt || createdAt);
        writeUrlEntryWithTracking(
          pageStream,
          cleanPath,
          lastmod,
          cleanPath === '/' ? 'daily' : 'weekly',
          cleanPath === '/' ? '1.0' : '0.8',
          'page',
          page.title,
          true
        );
      }
    });

    const endSitemapStream = async (stream: fs.WriteStream) => {
      stream.write('</urlset>');
      stream.end();
      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', (err) => reject(err));
      });
    };

    console.log('💾 Finalizing sub-sitemap files...');
    await Promise.all([
      endSitemapStream(pageStream),
      endSitemapStream(blogStream),
      endSitemapStream(offerStream),
      endSitemapStream(toursStream)
    ]);

    console.log('🗂️ Generating sitemap_index.xml...');
    const indexTempPath = path.join(PUBLIC_DIR, 'sitemap_index.xml.tmp');
    const indexStream = fs.createWriteStream(indexTempPath, { encoding: 'utf8' });
    indexStream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
    indexStream.write('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');

    const subSitemapFiles = [
      { name: 'page-sitemap.xml', lastmod: maxLastmodPage },
      { name: 'blog-sitemap.xml', lastmod: maxLastmodBlog },
      { name: 'offer-sitemap.xml', lastmod: maxLastmodOffer },
      { name: 'tours-sitemap.xml', lastmod: maxLastmodTour }
    ];

    subSitemapFiles.forEach(file => {
      indexStream.write(`  <sitemap>
    <loc>${SITE_URL}/${file.name}</loc>
    <lastmod>${file.lastmod}</lastmod>
  </sitemap>\n`);
    });

    indexStream.write('</sitemapindex>');
    indexStream.end();

    await new Promise<void>((resolve, reject) => {
      indexStream.on('finish', () => resolve());
      indexStream.on('error', (err) => reject(err));
    });

    // Move completed sitemaps into public/ and dist/
    const filesToCopy = [
      { temp: pageTempPath, name: 'page-sitemap.xml' },
      { temp: blogTempPath, name: 'blog-sitemap.xml' },
      { temp: offerTempPath, name: 'offer-sitemap.xml' },
      { temp: toursTempPath, name: 'tours-sitemap.xml' },
      { temp: indexTempPath, name: 'sitemap_index.xml' },
      { temp: indexTempPath, name: 'sitemap.xml' } // Copy index as sitemap.xml for legacy compatibility
    ];

    filesToCopy.forEach(f => {
      fs.copyFileSync(f.temp, path.join(PUBLIC_DIR, f.name));
      fs.copyFileSync(f.temp, path.join(DIST_DIR, f.name));
    });

    // Clean up temporary XML paths
    const uniqueTemps = Array.from(new Set(filesToCopy.map(f => f.temp)));
    uniqueTemps.forEach(tempPath => {
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {}
    });

    console.log('✨ All sitemaps (index and sub-sitemaps) generated successfully in public/ and dist/');

    // Generate Robots.txt
    const robotsTxt = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${SITE_URL}/sitemap_index.xml
`;
    fs.writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), robotsTxt);
    fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robotsTxt);
    console.log('✨ robots.txt generated successfully in public/ and dist/');

    // ----------------------------------------------------
    // NEW: Generate Stunning Luxury sitemap.html
    // ----------------------------------------------------
    console.log('💎 Generating highly polished luxury-themed sitemap.html...');
    const todayStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const staticHtmlEntries = sitemapHtmlEntries
      .filter(entry => entry.isStatic)
      .map(entry => `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#d4af37]/30 hover:bg-white/[0.04] transition-all group font-mono text-xs">
        <div class="flex items-center gap-3 truncate min-w-0">
          <span class="text-amber-500/60 grow-0 group-hover:translate-x-1 transition-transform">→</span>
          <a href="${entry.path}" target="_blank" class="text-white hover:text-[#d4af37] font-semibold truncate transition-colors">${entry.title}</a>
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 shrink-0 justify-between items-start">
          <span class="text-[9px] uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-sans font-bold">System Static</span>
          <span class="text-[10px] text-gray-500 font-mono">${entry.lastmod}</span>
        </div>
      </div>
      `).join('');

    const dynamicHtmlEntries = sitemapHtmlEntries
      .filter(entry => !entry.isStatic)
      .map(entry => {
        let badgeColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        let categoryName = 'Page';
        if (entry.category === 'blog') {
          badgeColor = 'text-green-400 bg-green-500/10 border-green-500/20';
          categoryName = 'Blog Post';
        } else if (entry.category === 'offer') {
          badgeColor = 'text-purple-400 bg-[#c084fc]/10 border-[#c084fc]/20';
          categoryName = 'VIP Offer';
        } else if (entry.category === 'tour') {
          badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
          categoryName = 'Luxury Tour';
        }

        return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#d4af37]/30 hover:bg-white/[0.04] transition-all group font-mono text-xs">
        <div class="flex items-center gap-3 truncate min-w-0">
          <span class="text-amber-500/60 grow-0 group-hover:translate-x-1 transition-transform">→</span>
          <a href="${entry.path}" target="_blank" class="text-white hover:text-[#d4af37] font-semibold truncate transition-colors">${entry.title}</a>
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 shrink-0 justify-between items-start">
          <span class="text-[9px] uppercase tracking-wider ${badgeColor} px-2 py-0.5 rounded font-sans font-bold">${categoryName}</span>
          <span class="text-[10px] text-gray-500 font-mono">${entry.lastmod}</span>
        </div>
      </div>
        `;
      }).join('');

    const sitemapHtmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Merlux Luxury Sitemap | Dynamic Index & Active Indexes</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background-color: #0b0c10;
      color: #e5e7eb;
    }
    .font-display {
      font-family: 'Space Grotesk', sans-serif;
    }
    .font-mono {
      font-family: 'JetBrains Mono', sans-serif;
    }
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.02);
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(212, 175, 55, 0.3);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(212, 175, 55, 0.6);
    }
    .custom-scrollbar {
      scrollbar-width: thin;
      scrollbar-color: rgba(212, 175, 55, 0.3) rgba(255, 255, 255, 0.02);
    }
  </style>
</head>
<body class="min-h-screen py-12 px-4 sm:px-6 lg:px-8 selection:bg-amber-500/20 selection:text-amber-200">
  <div class="max-w-6xl mx-auto space-y-10">
    
    <!-- Brand Header -->
    <header class="text-center space-y-4">
      <div class="inline-flex items-center gap-1.5 font-mono text-[9px] text-[#d4af37] uppercase tracking-wider bg-[#d4af37]/10 px-3 py-1 rounded-full border border-[#d4af37]/20">
        <span class="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse"></span>
        Sitemap Index Directory
      </div>
      <h1 class="text-3xl sm:text-4xl font-bold tracking-tight text-white font-display">
        MERLUX SITEMAP <span class="text-[#d4af37] font-medium font-serif italic">DIRECTORY</span>
      </h1>
      <p class="text-sm text-gray-400 max-w-md mx-auto">
        Stunning representation of dynamic system crawling, mapping dynamic luxury directories live from production.
      </p>
    </header>

    <!-- Sub-Sitemaps Grid -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Page Sitemap Link Card -->
      <a href="/page-sitemap.xml" target="_blank" class="block p-5 bg-white/5 border border-white/5 hover:border-[#d4af37]/30 rounded-2xl transition-all group hover:bg-white/[0.07]">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-mono text-[#d4af37] tracking-wider uppercase">Page Indexes</span>
          <span class="text-[10px] text-gray-500 font-mono group-hover:text-white transition-colors">XML</span>
        </div>
        <p class="text-lg font-bold text-white group-hover:text-[#d4af37] transition-colors font-display">page-sitemap.xml</p>
        <p class="text-xs text-gray-400 mt-2">Static & Dynamic customized landing page structures.</p>
      </a>

      <!-- Blog Sitemap Link Card -->
      <a href="/blog-sitemap.xml" target="_blank" class="block p-5 bg-white/5 border border-white/5 hover:border-[#d4af37]/30 rounded-2xl transition-all group hover:bg-white/[0.07]">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-mono text-[#d4af37] tracking-wider uppercase">Blog Indexes</span>
          <span class="text-[10px] text-gray-500 font-mono group-hover:text-white transition-colors">XML</span>
        </div>
        <p class="text-lg font-bold text-white group-hover:text-[#d4af37] transition-colors font-display">blog-sitemap.xml</p>
        <p class="text-xs text-gray-400 mt-2">Journal, travel guides, luxury chauffeur insights.</p>
      </a>

      <!-- Offer Sitemap Link Card -->
      <a href="/offer-sitemap.xml" target="_blank" class="block p-5 bg-white/5 border border-white/5 hover:border-[#d4af37]/30 rounded-2xl transition-all group hover:bg-white/[0.07]">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-mono text-[#d4af37] tracking-wider uppercase">Promo Offers</span>
          <span class="text-[10px] text-gray-500 font-mono group-hover:text-white transition-colors">XML</span>
        </div>
        <p class="text-lg font-bold text-white group-hover:text-[#d4af37] transition-colors font-display">offer-sitemap.xml</p>
        <p class="text-xs text-gray-400 mt-2">Special VIP promotions and airport deal pages.</p>
      </a>

      <!-- Tours Sitemap Link Card -->
      <a href="/tours-sitemap.xml" target="_blank" class="block p-5 bg-white/5 border border-white/5 hover:border-[#d4af37]/30 rounded-2xl transition-all group hover:bg-white/[0.07]">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-mono text-[#d4af37] tracking-wider uppercase">Tour Indexes</span>
          <span class="text-[10px] text-gray-500 font-mono group-hover:text-white transition-colors">XML</span>
        </div>
        <p class="text-lg font-bold text-white group-hover:text-[#d4af37] transition-colors font-display">tours-sitemap.xml</p>
        <p class="text-xs text-gray-400 mt-2">Custom-tailored sightseeing itineraries across Australia.</p>
      </a>
    </section>

    <!-- Main Directory Section -->
    <section class="bg-white/5 p-6 sm:p-8 rounded-3xl border border-white/5 space-y-8">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <p class="text-xs text-gray-400 uppercase tracking-widest font-mono">Dynamic XML Interactive Mirror</p>
          <h2 class="text-xl font-bold font-display text-white mt-1">Crawled Web Directory</h2>
        </div>
        <span class="text-[10px] font-mono text-[#d4af37] bg-[#d4af37]/10 px-3 py-1.5 rounded-xl border border-[#d4af37]/20">
          Last Compiled: ${todayStr} UTC
        </span>
      </div>

      <!-- Static Infrastructure Section -->
      <div class="space-y-4">
        <h3 class="text-xs text-gray-500 uppercase tracking-[0.2em] font-bold font-display px-1">Static Infrastructure</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pl-1">
          ${staticHtmlEntries || '<p class="text-xs text-gray-500 italic pl-1">No static endpoints found.</p>'}
        </div>
      </div>

      <!-- Live Dynamic Directory Section -->
      <div class="space-y-4 pt-4 border-t border-white/5">
        <h3 class="text-xs text-gray-500 uppercase tracking-[0.2em] font-bold font-display px-1">Dynamic Database Entries</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pl-1">
          ${dynamicHtmlEntries || '<p class="text-xs text-gray-500 italic pl-1">No dynamic collections found or Firestore is loaded off-line during build time.</p>'}
        </div>
      </div>
    </section>
  </div>
</body>
</html>`;

    fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.html'), sitemapHtmlBody, { encoding: 'utf8' });
    fs.writeFileSync(path.join(DIST_DIR, 'sitemap.html'), sitemapHtmlBody, { encoding: 'utf8' });
    console.log('✨ sitemap.html visual directory successfully compiled in public/ and dist/');

  } catch (error) {
    console.error('❌ Error generating sitemaps:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

generateSitemap();
