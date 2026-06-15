import generateSitemap from '../../scripts/generate-sitemap';

export default async (req: any, res: any) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Call the generator in-process. This avoids spawning child processes which
    // are often restricted in serverless environments.
    await generateSitemap();
    return res.status(200).json({ success: true, message: 'Sitemap regenerated' });
  } catch (err: any) {
    console.error('Sitemap generation error:', err);
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
};
