import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Error');
  const { subject, title, url } = req.body;
  try {
    await db.ref(`answers/${subject}`).push({ title, url, time: new Date().toISOString() });
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ success: false }); }
}
