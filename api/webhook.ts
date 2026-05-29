import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(200).send('OK'); return; }
  const events = req.body.events;
  if (!events || events.length === 0) { res.status(200).send('OK'); return; }

  const LINE_TOKEN = process.env.LINE_ACCESS_TOKEN;

  const tasks = events.map(function(event: any) {
    const replyToken = event.replyToken;
    const userId = event.source?.userId; 

    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();

      // 🟢 動作 1：切換圖文選單
      if (text === '社會') {
        const menuId = process.env.MENU_SOCIAL || '';
        if (menuId && userId) return switchRichMenu(userId, menuId, LINE_TOKEN);
      } 
      else if (text === '課本') {
        const menuId = process.env.MENU_TEXTBOOK || '';
        if (menuId && userId) return switchRichMenu(userId, menuId, LINE_TOKEN);
      } 
      else if (text === '主選單' || text === '返回主選單') {
        const menuId = process.env.MENU_MAIN || '';
        if (menuId && userId) return switchRichMenu(userId, menuId, LINE_TOKEN);
      } 
      
      // 🟢 動作 2：去資料庫找解答或課本
      else {
        let dbNode = 'answers'; // 預設找解答
        let subject = text;

        // 如果文字結尾是「課本」(例如: 國文課本)，就把節點切換到 textbooks，並把課本兩個字濾掉
        if (text.endsWith('課本') && text !== '課本') {
          dbNode = 'textbooks';
          subject = text.replace('課本', ''); 
        }

        // 去 Firebase 撈取資料
        return db.ref(`${dbNode}/${subject}`).once('value')
          .then(function(snapshot) {
            if (snapshot.exists()) {
              const dataList = Object.values(snapshot.val());
              const prefix = dbNode === 'textbooks' ? '課本' : '解答';
              return sendFlexMessage(replyToken, LINE_TOKEN, `${subject}${prefix}專區`, dataList);
            } else {
              return replyText(replyToken, LINE_TOKEN, `目前資料庫還沒有「${text}」的檔案喔！`);
            }
          })
          .catch(function(error) {
            console.error('資料庫讀取失敗:', error);
          });
      }
    }

    return Promise.resolve();
  });

  // 強制等待所有任務跑完
  Promise.all(tasks)
    .then(function() { res.status(200).send('OK'); })
    .catch(function() { res.status(500).send('Error'); });
}

// === 切換圖文選單 API ===
function switchRichMenu(userId: string, menuId: string, token: string | undefined) {
  return axios.post(`https://api.line.me/v2/bot/user/${userId}/richmenu/${menuId}`, {}, { 
    headers: { Authorization: `Bearer ${token}` } 
  })
  .then(function(){})
  .catch(function(e) { console.error('切換選單失敗', e); });
}

// === 發送極簡深色風 Flex Message ===
function sendFlexMessage(replyToken: string, token: string | undefined, titleText: string, items: any[]) {
  const buttons = items.map(function(item: any) {
    return { 
      type: "button", 
      style: "secondary", 
      margin: "sm", 
      height: "sm", 
      action: { type: "uri", label: item.title, uri: item.url } 
    };
  });

  const flexMessage = {
    type: "flex", 
    altText: titleText,
    contents: {
      type: "bubble", 
      size: "kilo",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#111111",
        contents: [
          { type: "text", text: titleText, weight: "bold", color: "#ffffff", size: "xl" }
        ]
      },
      body: { type: "box", layout: "vertical", spacing: "md", contents: buttons }
    }
  };

  return axios.post('https://api.line.me/v2/bot/message/reply', { 
    replyToken: replyToken, messages: [flexMessage] 
  }, { headers: { Authorization: `Bearer ${token}` } });
}

// === 發送純文字 ===
function replyText(replyToken: string, token: string | undefined, text: string) {
  return axios.post('https://api.line.me/v2/bot/message/reply', { 
    replyToken: replyToken, messages: [{ type: 'text', text: text }] 
  }, { headers: { Authorization: `Bearer ${token}` } });
}
