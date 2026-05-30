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

      // 🟢 動作 1：切換圖文選單 (包含剛綁定成功的 @更新選單)
      if (text === '社會' || text === '課本' || text === '主選單' || text === '返回主選單' || text === '@更新選單') {
        
        let menuId = '';
        if (text === '社會') menuId = process.env.MENU_SOCIAL || '';
        else if (text === '課本') menuId = process.env.MENU_TEXTBOOK || '';
        else menuId = process.env.MENU_MAIN || ''; // 包含主選單與 @更新選單 都切回主選單

        if (menuId && userId) {
          return switchRichMenu(userId, menuId, LINE_TOKEN).then(() => {
             // 如果是綁定成功傳來的指令，可以不回話或回個溫馨提示
             if(text === '@更新選單') {
                 return replyText(replyToken, LINE_TOKEN, '🎉 裝置綁定成功！您的專屬學習選單已啟動。');
             }
             return Promise.resolve();
          });
        }
      } 
      
      // 🟢 動作 2：去資料庫找解答或課本，並【寫入點擊紀錄】
      else {
        let dbNode = 'answers'; 
        let subject = text;
        let logType = '解答';

        if (text.endsWith('課本') && text !== '課本') {
          dbNode = 'textbooks';
          subject = text.replace('課本', ''); 
          logType = '課本';
        }

        return db.ref(`${dbNode}/${subject}`).once('value')
          .then(function(snapshot) {
            if (snapshot.exists()) {
              const dataList = Object.values(snapshot.val());
              const prefix = dbNode === 'textbooks' ? '課本' : '解答';
              
              // 🏆 關鍵：寫入日誌紀錄
              if (userId) {
                db.ref('logs/access').push({
                  userId: userId,
                  type: logType,
                  subject: subject,
                  timestamp: new Date().toISOString()
                }).catch(e => console.error("日誌寫入失敗:", e)); // 失敗不阻斷發訊息
              }

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

  Promise.all(tasks)
    .then(function() { res.status(200).send('OK'); })
    .catch(function() { res.status(500).send('Error'); });
}

// === API 函式區 ===
function switchRichMenu(userId: string, menuId: string, token: string | undefined) {
  return axios.post(`https://api.line.me/v2/bot/user/${userId}/richmenu/${menuId}`, {}, { 
    headers: { Authorization: `Bearer ${token}` } 
  })
  .then(function(){})
  .catch(function(e) { console.error('切換選單失敗', e); });
}

function sendFlexMessage(replyToken: string, token: string | undefined, titleText: string, items: any[]) {
  const listItems = items.map(function(item: any) {
    return {
      type: "box", layout: "horizontal", spacing: "md", paddingAll: "16px", cornerRadius: "16px", backgroundColor: "#f8fafc",
      action: { type: "uri", label: "開啟檔案", uri: item.url },
      contents: [
        { type: "text", text: "📄", flex: 0, size: "md", gravity: "center" },
        { type: "text", text: item.title, weight: "bold", color: "#111111", size: "sm", gravity: "center", wrap: true }
      ]
    };
  });

  const flexMessage = {
    type: "flex", altText: titleText,
    contents: {
      type: "bubble", size: "mega",
      body: {
        type: "box", layout: "vertical", paddingAll: "0px",
        contents: [
          {
            type: "box", layout: "vertical", backgroundColor: "#000000", paddingAll: "24px",
            contents: [
              { type: "text", text: "Smart Education", color: "#888888", size: "xs", weight: "bold" },
              { type: "text", text: titleText, color: "#ffffff", size: "xl", weight: "bold", margin: "sm" }
            ]
          },
          {
            type: "box", layout: "vertical", paddingAll: "24px", spacing: "md",
            contents: listItems.length > 0 ? listItems : [{ type: "text", text: "此分類暫無檔案", color: "#94a3b8", size: "sm", align: "center" }]
          }
        ]
      }
    }
  };

  return axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [flexMessage] }, { headers: { Authorization: `Bearer ${token}` } });
}

function replyText(replyToken: string, token: string | undefined, text: string) {
  return axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [{ type: 'text', text: text }] }, { headers: { Authorization: `Bearer ${token}` } });
}
