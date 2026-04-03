import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

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

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
