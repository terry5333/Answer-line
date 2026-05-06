import { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  var body = req.body;

  // 100% 純 Callback (.then) 寫入資料
  db.ref('answers/' + body.subject).push({
    title: body.title,
    url: body.url,
    createdAt: new Date().toISOString()
  })
  .then(function() {
    res.status(200).json({ success: true });
  })
  .catch(function(error) {
    res.status(500).json({ success: false, message: error.message });
  });
}
