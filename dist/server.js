// server.ts
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import fs from "fs";
import twilio from "twilio";
import nodemailer from "nodemailer";
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
if (!admin.apps.length) {
  const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
  const projectId = config.projectId;
  const databaseId = config.firestoreDatabaseId;
  console.log(`Initializing Firebase Admin for project: ${projectId}, database: ${databaseId}`);
  delete process.env.FIREBASE_CONFIG;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  admin.initializeApp({
    projectId
  });
  console.log(`Firebase Admin initialized with project: ${projectId}`);
  if (databaseId) {
    admin.firestore().settings({ databaseId });
  }
}
var dbAdmin = admin.firestore();
var stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
async function startServer() {
  const app = express();
  const PORT = 3e3;
  app.use(cors());
  app.use(express.json());
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { bookingData, vehicleName, cancelUrl } = req.body;
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY is not set");
      }
      const bookingDataString = JSON.stringify(bookingData);
      const description = bookingData.dropoff && bookingData.dropoff !== "N/A" ? `${bookingData.serviceType.toUpperCase()} - ${bookingData.pickup} to ${bookingData.dropoff}` : `${bookingData.serviceType.toUpperCase()} - ${bookingData.pickup}`;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "aud",
              product_data: {
                name: `Chauffeur Service: ${vehicleName}`,
                description
              },
              unit_amount: Math.round(bookingData.price * 100)
              // Stripe expects cents
            },
            quantity: 1
          }
        ],
        mode: "payment",
        success_url: `${process.env.APP_URL || "http://localhost:3000"}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${process.env.APP_URL || "http://localhost:3000"}/booking`,
        metadata: {
          bookingDataChunk1: bookingDataString.substring(0, 450),
          bookingDataChunk2: bookingDataString.substring(450, 900),
          bookingDataChunk3: bookingDataString.substring(900, 1350),
          bookingDataChunk4: bookingDataString.substring(1350, 1800)
        }
      });
      res.json({ id: session.id, url: session.url });
    } catch (error) {
      console.error("Stripe Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/checkout-session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/admin/create-user", async (req, res) => {
    try {
      const { email, password, displayName, role, phone, address } = req.body;
      console.log(`Attempting to create user: ${email} in project ${admin.app().options.projectId}`);
      const userRecord = await admin.auth().createUser({
        email: email.toLowerCase(),
        password,
        displayName,
        phoneNumber: phone || void 0
      });
      await dbAdmin.collection("users").doc(userRecord.uid).set({
        id: userRecord.uid,
        name: displayName,
        email: email.toLowerCase(),
        phone: phone || "",
        address: address || "",
        role: role || "customer",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ success: true, uid: userRecord.uid });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: error.message + ": " + JSON.stringify(req.body), code: error.code });
    }
  });
  app.post("/api/send-sms", async (req, res) => {
    try {
      const { to, message } = req.body;
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        console.warn("Twilio configuration is missing in environment variables.");
        return res.status(400).json({ error: "Twilio configuration is missing" });
      }
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const response = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to
      });
      res.json({ success: true, sid: response.sid });
    } catch (error) {
      if (error.code === 20003) {
        console.error("Twilio Auth Error: Invalid API keys. Please verify your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
        return res.status(401).json({ error: "Twilio Authentication Failed" });
      }
      console.error("Twilio SMS Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, html } = req.body;
      if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_FROM) {
        console.warn("SMTP configuration is missing in environment variables.");
        return res.status(400).json({ error: "SMTP configuration is missing" });
      }
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: parseInt(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: Array.isArray(to) ? to.join(",") : to,
        subject,
        html
      });
      res.json({ success: true, messageId: info.messageId });
    } catch (error) {
      console.error("Email Send Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/favicon.ico", async (req, res, next) => {
    try {
      const settingsSnap = await dbAdmin.collection("settings").doc("system").get();
      const favicon = settingsSnap.data()?.seo?.favicon;
      if (favicon) {
        return res.redirect(favicon);
      }
    } catch (e) {
    }
    next();
  });
  app.get("/logo.png", async (req, res, next) => {
    try {
      const settingsSnap = await dbAdmin.collection("settings").doc("system").get();
      const logo = settingsSnap.data()?.seo?.logo;
      if (logo) {
        return res.redirect(logo);
      }
    } catch (e) {
    }
    next();
  });
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const pagesSnap = await dbAdmin.collection("pages").where("noindex", "!=", true).get();
      const blogsSnap = await dbAdmin.collection("blogs").get();
      const baseUrl = process.env.APP_URL || "https://merlux.com.au";
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><priority>1.0</priority></url>
  <url><loc>${baseUrl}/booking</loc><priority>0.8</priority></url>
  <url><loc>${baseUrl}/fleet</loc><priority>0.8</priority></url>
  <url><loc>${baseUrl}/services</loc><priority>0.8</priority></url>
  <url><loc>${baseUrl}/about</loc><priority>0.7</priority></url>
  <url><loc>${baseUrl}/contact</loc><priority>0.7</priority></url>
  <url><loc>${baseUrl}/blog</loc><priority>0.7</priority></url>`;
      pagesSnap.forEach((doc) => {
        const data = doc.data();
        if (data.includeInSitemap !== false) {
          xml += `
  <url><loc>${baseUrl}/${data.slug}</loc><priority>0.6</priority></url>`;
        }
      });
      blogsSnap.forEach((doc) => {
        const data = doc.data();
        xml += `
  <url><loc>${baseUrl}/blog/${data.slug}</loc><priority>0.5</priority></url>`;
      });
      xml += "\n</urlset>";
      res.header("Content-Type", "application/xml");
      res.send(xml);
    } catch (error) {
      res.status(500).send("Error generating sitemap");
    }
  });
  app.get("/robots.txt", (req, res) => {
    const baseUrl = process.env.APP_URL || "https://merlux.com.au";
    res.header("Content-Type", "text/plain");
    res.send(`User-agent: *
Allow: /
Sitemap: ${baseUrl}/sitemap.xml`);
  });
  const injectSEO = async (html, url) => {
    try {
      const settingsSnap = await dbAdmin.collection("settings").doc("system").get();
      const globalSettings = settingsSnap.exists ? settingsSnap.data() : null;
      const globalSeo = globalSettings?.seo || {};
      let slug = url.split("?")[0].split("/").pop() || "";
      let isBlog = url.includes("/blog/");
      let seoData = null;
      if (isBlog) {
        const snap = await dbAdmin.collection("blogs").where("slug", "==", slug).limit(1).get();
        if (!snap.empty) seoData = snap.docs[0].data();
      } else if (slug) {
        const snap = await dbAdmin.collection("pages").where("slug", "==", slug).limit(1).get();
        if (!snap.empty) seoData = snap.docs[0].data();
      } else {
        const snap = await dbAdmin.collection("pages").where("slug", "==", "home").limit(1).get();
        if (!snap.empty) seoData = snap.docs[0].data();
      }
      const siteName = globalSeo.siteName || "Merlux Chauffeur Services";
      const defaultTitle = globalSeo.defaultTitle || "Luxury Chauffeur Melbourne";
      const titleTemplate = globalSeo.titleTemplate || `%s | ${siteName}`;
      let title = seoData?.metaTitle || seoData?.title || defaultTitle;
      if (title !== defaultTitle && !title.includes(siteName)) {
        title = titleTemplate.replace("%s", title);
      }
      const desc = seoData?.metaDescription || globalSeo.defaultDescription || "";
      const seoKeywords = Array.isArray(seoData?.keywords) ? seoData.keywords : typeof seoData?.keywords === "string" ? seoData.keywords.split(",").map((k) => k.trim()) : [];
      const defaultKeywords = Array.isArray(globalSeo.defaultKeywords) ? globalSeo.defaultKeywords : typeof globalSeo.defaultKeywords === "string" ? globalSeo.defaultKeywords.split(",").map((k) => k.trim()) : [];
      const keywords = [...seoKeywords, ...defaultKeywords].filter((k) => k !== "").join(", ");
      const favicon = globalSeo.favicon ? `<link rel="icon" href="${globalSeo.favicon}" />` : "";
      const ogImage = seoData?.ogImage || seoData?.featuredImage || globalSeo.ogImage || globalSeo.logo || "";
      const canonical = seoData?.canonicalUrl || `${process.env.APP_URL || ""}${url}`;
      const noindex = seoData?.noindex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">';
      const pageSchema = seoData?.schema ? `<script type="application/ld+json">${JSON.stringify(seoData.schema)}</script>` : "";
      const orgSchema = globalSeo.organizationSchema ? `<script type="application/ld+json">${JSON.stringify(globalSeo.organizationSchema)}</script>` : "";
      const gaScript = globalSeo.googleAnalyticsId ? `
        <script async src="https://www.googletagmanager.com/gtag/js?id=${globalSeo.googleAnalyticsId}"></script>
        <script>
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${globalSeo.googleAnalyticsId}');
        </script>
      ` : "";
      const scMeta = globalSeo.searchConsoleId ? `<meta name="google-site-verification" content="${globalSeo.searchConsoleId}" />` : "";
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
      return html.replace(/<title>.*?<\/title>/, "").replace("</head>", `${seoTags}</head>`);
    } catch (error) {
      console.error("SEO Injection Error:", error);
      return html;
    }
  };
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      if (url.includes(".") || url.startsWith("/api/")) return next();
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        const html = await injectSEO(template, url);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false }));
    app.get("*", async (req, res) => {
      try {
        const template = fs.readFileSync(path.join(distPath, "index.html"), "utf-8");
        const html = await injectSEO(template, req.originalUrl);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        res.status(500).end("Internal Server Error");
      }
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
