import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const token = process.env.LINE_ACCESS_TOKEN;
  
  if (!token) {
    res.status(400).json({ success: false, message: 'Vercel 尚未設定 LINE_ACCESS_TOKEN' });
    return;
  }

  // 使用純 Callback 呼叫 LINE API
  axios.get('https://api.line.me/v2/bot/richmenu/list', {
    headers: { Authorization: `Bearer ${token}` }
  })
  .then(function(response) {
    res.status(200).json({ success: true, menus: response.data.richmenus });
  })
  .catch(function(error) {
    res.status(500).json({ success: false, message: error.message });
  });
}
