import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    // 這裡未來會放 Firebase 綁定邏輯
    const { userId, stuNo } = req.body;
    return res.status(200).json({ success: true, message: "綁定 API 準備就緒" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
