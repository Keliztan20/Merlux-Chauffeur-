import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let dbAdmin: admin.firestore.Firestore;

try {
  const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'firebase-applet-config.json');
  let config: any = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  const projectId = config.projectId || process.env.VITE_FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const databaseId = config.firestoreDatabaseId || process.env.VITE_FIREBASE_DATABASE_ID;

  console.log('Initializing Firebase Admin with:', { projectId, databaseId });

  if (!admin.apps.length) {
    if (projectId) {
      admin.initializeApp({ projectId });
    } else {
      admin.initializeApp();
    }
  }

  // In firebase-admin v11+, you can pass the databaseId to firestore()
  const dbId = databaseId && databaseId !== '(default)' ? databaseId : undefined;
  dbAdmin = dbId ? admin.firestore(dbId) : admin.firestore();

} catch (err) {
  console.error('Firebase Admin Initialization Error:', err);
  dbAdmin = admin.firestore();
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Admin: Test Firestore Connection
  app.get('/api/admin/test-firestore', async (req, res) => {
    try {
      const collections = await dbAdmin.listCollections();
      let authStatus = 'Unknown';
      try {
        await admin.auth().listUsers(1);
        authStatus = 'Identity Toolkit API is Enabled';
      } catch (e: any) {
        if (e.message.includes('identitytoolkit.googleapis.com')) {
          authStatus = 'Identity Toolkit API is DISABLED (Action Required)';
        } else {
          authStatus = `Auth Error: ${e.message}`;
        }
      }
      
      res.json({ 
        success: true, 
        collections: collections.map(c => c.id),
        projectId: admin.app().options.projectId || 'default',
        authStatus
      });
    } catch (error: any) {
      console.error('Firestore Test Error:', error);
      res.status(500).json({ 
        error: error.message,
        code: error.code,
        details: error.details
      });
    }
  });

  // Stripe Checkout Session Endpoint
  app.post('/api/create-checkout-session', async (req, res) => {
    try {
      const { bookingData, vehicleName } = req.body;

      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is not set');
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'aud',
              product_data: {
                name: `Chauffeur Service: ${vehicleName}`,
                description: `${bookingData.serviceType.toUpperCase()} - ${bookingData.pickup} to ${bookingData.dropoff}`,
              },
              unit_amount: Math.round(bookingData.price * 100), // Stripe expects cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/booking`,
        metadata: {
          bookingData: JSON.stringify(bookingData),
        },
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error('Stripe Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/checkout-session/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create User in Auth
  app.post('/api/admin/create-user', async (req, res) => {
    try {
      const { email, password, displayName, role, phone, address } = req.body;

      // Create user in Firebase Auth
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
        phoneNumber: phone || undefined,
      });

      // Set custom claims for role
      await admin.auth().setCustomUserClaims(userRecord.uid, { role: role || 'customer' });

      // Create user document in Firestore
      await dbAdmin.collection('users').doc(userRecord.uid).set({
        id: userRecord.uid,
        name: displayName,
        email: email.toLowerCase(),
        phone: phone || '',
        address: address || '',
        role: role || 'customer',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update User Role (Custom Claims)
  app.post('/api/admin/update-user-role', async (req, res) => {
    try {
      const { uid, role } = req.body;
      if (!uid || !role) {
        return res.status(400).json({ error: 'UID and Role are required' });
      }
      await admin.auth().setCustomUserClaims(uid, { role });
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating user role claims:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete User from Firestore ONLY
  app.post('/api/admin/delete-user', async (req, res) => {
    try {
      const { uid } = req.body;
      if (!uid) return res.status(400).json({ error: 'User ID is required' });
      
      try {
        await dbAdmin.collection('users').doc(uid).delete();
      } catch (e: any) {
        // If permission denied on named database, try default database as fallback
        if (e.message.includes('PERMISSION_DENIED') || e.code === 7) {
          console.log('Permission denied on configured database, trying default database...');
          await admin.firestore().collection('users').doc(uid).delete();
        } else {
          throw e;
        }
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting user from Firestore:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: List Firebase Auth Users
  app.get('/api/admin/list-auth-users', async (req, res) => {
    console.log('Received request to list auth users');
    try {
      const listUsersResult = await admin.auth().listUsers(1000);
      console.log(`Found ${listUsersResult.users.length} auth users`);
      const users = listUsersResult.users.map(user => ({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        providerData: user.providerData.map(p => p.providerId),
        createdAt: user.metadata.creationTime,
        lastSignInAt: user.metadata.lastSignInTime,
      }));
      res.json({ users });
    } catch (error: any) {
      console.error('Error listing auth users:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete User from Firebase Auth
  app.post('/api/admin/delete-auth-user', async (req, res) => {
    try {
      const { uid } = req.body;
      if (!uid) return res.status(400).json({ error: 'User ID is required' });
      await admin.auth().deleteUser(uid);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting auth user:', error);
      let message = error.message;
      if (message.includes('identitytoolkit.googleapis.com')) {
        message = 'The "Identity Toolkit API" is not enabled in your Google Cloud project. Please enable it at https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=' + process.env.GOOGLE_CLOUD_PROJECT + ' to allow deleting users from Firebase Auth.';
      }
      res.status(500).json({ error: message });
    }
  });

  // Favicon Redirect
  app.get('/favicon.ico', async (req, res, next) => {
    try {
      const settingsSnap = await dbAdmin.collection('settings').doc('system').get();
      const favicon = settingsSnap.data()?.seo?.favicon;
      if (favicon) {
        return res.redirect(favicon);
      }
    } catch (e) {}
    next();
  });

  // Logo Redirect
  app.get('/logo.png', async (req, res, next) => {
    try {
      const settingsSnap = await dbAdmin.collection('settings').doc('system').get();
      const logo = settingsSnap.data()?.seo?.logo;
      if (logo) {
        return res.redirect(logo);
      }
    } catch (e) {}
    next();
  });

  // Sitemap Generator
  app.get('/sitemap.xml', async (req, res) => {
    try {
      const pagesSnap = await dbAdmin.collection('pages').where('noindex', '!=', true).get();
      const blogsSnap = await dbAdmin.collection('blogs').get();

      const baseUrl = process.env.APP_URL || 'https://merlux.com.au';

      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><priority>1.0</priority></url>
  <url><loc>${baseUrl}/booking</loc><priority>0.8</priority></url>
  <url><loc>${baseUrl}/fleet</loc><priority>0.8</priority></url>
  <url><loc>${baseUrl}/services</loc><priority>0.8</priority></url>
  <url><loc>${baseUrl}/about</loc><priority>0.7</priority></url>
  <url><loc>${baseUrl}/contact</loc><priority>0.7</priority></url>
  <url><loc>${baseUrl}/blog</loc><priority>0.7</priority></url>`;

      pagesSnap.forEach(doc => {
        const data = doc.data();
        if (data.includeInSitemap !== false) {
          xml += `\n  <url><loc>${baseUrl}/${data.slug}</loc><priority>0.6</priority></url>`;
        }
      });

      blogsSnap.forEach(doc => {
        const data = doc.data();
        xml += `\n  <url><loc>${baseUrl}/blog/${data.slug}</loc><priority>0.5</priority></url>`;
      });

      xml += '\n</urlset>';

      res.header('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      res.status(500).send('Error generating sitemap');
    }
  });

  // Robots.txt
  app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.APP_URL || 'https://merlux.com.au';
    res.header('Content-Type', 'text/plain');
    res.send(`User-agent: *
Allow: /
Sitemap: ${baseUrl}/sitemap.xml`);
  });

  // Helper for SEO injection
  const injectSEO = async (html: string, url: string) => {
    try {
      const settingsSnap = await dbAdmin.collection('settings').doc('system').get();
      const globalSettings = settingsSnap.exists ? settingsSnap.data() : null;
      const globalSeo = globalSettings?.seo || {};

      let slug = url.split('?')[0].split('/').pop() || '';
      let isBlog = url.includes('/blog/');

      let seoData: any = null;

      if (isBlog) {
        const snap = await dbAdmin.collection('blogs').where('slug', '==', slug).limit(1).get();
        if (!snap.empty) seoData = snap.docs[0].data();
      } else if (slug) {
        const snap = await dbAdmin.collection('pages').where('slug', '==', slug).limit(1).get();
        if (!snap.empty) seoData = snap.docs[0].data();
      } else {
        // Home page or other static pages without dynamic slug
        const snap = await dbAdmin.collection('pages').where('slug', '==', 'home').limit(1).get();
        if (!snap.empty) seoData = snap.docs[0].data();
      }

      const siteName = globalSeo.siteName || 'Merlux Chauffeur Services';
      const defaultTitle = globalSeo.defaultTitle || 'Luxury Chauffeur Melbourne';
      const titleTemplate = globalSeo.titleTemplate || `%s | ${siteName}`;

      let title = seoData?.metaTitle || seoData?.title || defaultTitle;
      if (title !== defaultTitle && !title.includes(siteName)) {
        title = titleTemplate.replace('%s', title);
      }

      const desc = seoData?.metaDescription || globalSeo.defaultDescription || '';
      const seoKeywords = Array.isArray(seoData?.keywords) ? seoData.keywords : (typeof seoData?.keywords === 'string' ? seoData.keywords.split(',').map((k: string) => k.trim()) : []);
      const defaultKeywords = Array.isArray(globalSeo.defaultKeywords) ? globalSeo.defaultKeywords : (typeof globalSeo.defaultKeywords === 'string' ? globalSeo.defaultKeywords.split(',').map((k: string) => k.trim()) : []);
      const keywords = [...seoKeywords, ...defaultKeywords].filter(k => k !== '').join(', ');
      const favicon = globalSeo.favicon ? `<link rel="icon" href="${globalSeo.favicon}" />` : '';
      const ogImage = seoData?.ogImage || seoData?.featuredImage || globalSeo.ogImage || globalSeo.logo || '';
      const canonical = seoData?.canonicalUrl || `${process.env.APP_URL || ''}${url}`;
      const noindex = seoData?.noindex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">';

      const pageSchema = seoData?.schema ? `<script type="application/ld+json">${JSON.stringify(seoData.schema)}</script>` : '';
      const orgSchema = globalSeo.organizationSchema ? `<script type="application/ld+json">${JSON.stringify(globalSeo.organizationSchema)}</script>` : '';
      
      const gaScript = globalSeo.googleAnalyticsId ? `
        <script async src="https://www.googletagmanager.com/gtag/js?id=${globalSeo.googleAnalyticsId}"></script>
        <script>
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${globalSeo.googleAnalyticsId}');
        </script>
      ` : '';

      const scMeta = globalSeo.searchConsoleId ? `<meta name="google-site-verification" content="${globalSeo.searchConsoleId}" />` : '';

      const seoTags = `
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta name="keywords" content="${keywords}" />
    <link rel="canonical" href="${canonical}" />
    ${favicon}
    ${noindex}
    ${scMeta}
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${ogImage}" />
    <meta name="twitter:card" content="summary_large_image" />
    ${orgSchema}
    ${pageSchema}
    ${gaScript}
      `;

      // Replace default title and add other tags
      return html
        .replace(/<title>.*?<\/title>/, '')
        .replace('</head>', `${seoTags}</head>`);
    } catch (error) {
      console.error('SEO Injection Error:', error);
      return html;
    }
  };

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);

    // SEO injection in dev mode
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.includes('.') || url.startsWith('/api/')) return next();

      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        const html = await injectSEO(template, url);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));

    app.get('*', async (req, res) => {
      try {
        const template = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
        const html = await injectSEO(template, req.originalUrl);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        res.status(500).end('Internal Server Error');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
