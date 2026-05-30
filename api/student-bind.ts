import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const action = req.body?.action || req.query?.action;
  const seat = req.body?.seat;
  const lineId = req.body?.lineId;
  const avatarUrl = req.body?.avatarUrl;

  if (action === 'check') {
    if (!seat) { res.status(400).json({ success: false, message: '請輸入座號' }); return; }
    db.ref(`students/${seat}`).once('value').then(function(snapshot) {
      if (snapshot.exists()) {
        const sData = snapshot.val();
        if (sData.lineId) { res.status(200).json({ success: false, message: '此座號已被綁定！' }); }
        else { res.status(200).json({ success: true, name: sData.name }); }
      } else { res.status(200).json({ success: false, message: '查無此座號，請確認老師是否建檔' }); }
    }).catch(function(err) { res.status(500).json({ success: false, message: err.message }); });
    return;
  } 

  if (action === 'confirm') {
    if (!seat || !lineId) { res.status(400).json({ success: false, message: '參數不完整' }); return; }
    
    const LINE_TOKEN = process.env.LINE_ACCESS_TOKEN;
    const menuId = process.env.MENU_MAIN || '';

    db.ref(`students/${seat}`).once('value').then(function(snapshot) {
      const sData = snapshot.val();
      const updates: any = {};
      updates[`students/${seat}/lineId`] = lineId;
      updates[`students/${seat}/avatarUrl`] = avatarUrl || '';
      updates[`users/${lineId}`] = { 
        seat: seat, 
        name: sData.name, 
        avatarUrl: avatarUrl || '', 
        boundAt: new Date().toISOString() 
      };
      return db.ref().update(updates);
    })
    .then(function() {
      if (!LINE_TOKEN) return Promise.resolve();

      // 🏆 終極優化：將「換選單」與「主動推播訊息」打包成並行事件，防止執行緒卡死
      const lineTasks = [];

      // 任務 A：更換圖文選單
      if (menuId) {
        const menuUrl = `https://api.line.me/v2/bot/user/${lineId}/richmenu/${menuId}`;
        lineTasks.push(
          axios.post(menuUrl, {}, { headers: { Authorization: `Bearer ${LINE_TOKEN}` } })
            .catch(e => console.error('後台換選單失敗:', e.message))
        );
      }

      // 任務 B：主動發送 Push 祝賀訊息
      const pushUrl = `https://api.line.me/v2/bot/message/push`;
      const pushPayload = {
        to: lineId,
        messages: [{
          type: 'text',
          text: '🎉 系統通知：您的裝置已成功完成身分認證！\n專屬學習選單已開通，現在可以開始查閱解答與課本囉！'
        }]
      };
      lineTasks.push(
        axios.post(pushUrl, pushPayload, { headers: { Authorization: `Bearer ${LINE_TOKEN}` } })
          .catch(e => console.error('主動推播失敗:', e.message))
      );

      return Promise.all(lineTasks);
    })
    .then(function() { 
      res.status(200).json({ success: true }); 
    })
    .catch(function(err) { 
      res.status(500).json({ success: false, message: err.message }); 
    });
    return;
  }
  
  res.status(400).json({ success: false, message: '無效的操作' });
}
