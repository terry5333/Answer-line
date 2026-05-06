import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { db } from './firebase';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(200).send('OK'); return; }
  const events = req.body.events;
  if (!events || events.length === 0) { res.status(200).send('OK'); return; }

  const LINE_TOKEN = process.env.LINE_ACCESS_TOKEN;

  events.forEach(function(event: any) {
    const replyToken = event.replyToken;
    const userId = event.source.userId;

    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();

      // 👉 1. 切換選單指令
      if (text === '社會' || text === '切換社會') {
        if (process.env.MENU_SOCIAL) {
          switchRichMenu(userId, process.env.MENU_SOCIAL, LINE_TOKEN).then(function() { replyText(replyToken, LINE_TOKEN, '✅ 已進入「社會」選單'); }).catch(function(e){});
        }
      } 
      else if (text === '課本' || text === '切換課本') {
        if (process.env.MENU_TEXTBOOK) {
          switchRichMenu(userId, process.env.MENU_TEXTBOOK, LINE_TOKEN).then(function() { replyText(replyToken, LINE_TOKEN, '✅ 已進入「課本」選單'); }).catch(function(e){});
        }
      } 
      else if (text === '主選單' || text === '回主選單') {
        if (process.env.MENU_MAIN) {
          switchRichMenu(userId, process.env.MENU_MAIN, LINE_TOKEN).then(function() { replyText(replyToken, LINE_TOKEN, '🏠 已回到主選單'); }).catch(function(e){});
        }
      } 
      // 👉 2. 查詢「課本」 (例如學生點擊圖文選單的 "國文課本")
      else if (text.indexOf('課本') !== -1) {
        const subject = text.replace('課本', ''); // 把"國文課本"變成"國文"
        fetchData('textbooks', subject, replyToken, LINE_TOKEN, `${subject} 課本專區`);
      }
      // 👉 3. 查詢「解答」 (例如學生點擊圖文選單的 "國文")
      else {
        const subjects = ['國文', '英文', '數學', '歷史', '地理', '公民', '其他'];
        if (subjects.includes(text)) {
          fetchData('answers', text, replyToken, LINE_TOKEN, `${text} 解答專區`);
        }
      }
    }
  });
  res.status(200).send('OK');
}

// 統一去 Firebase 撈資料的模組
function fetchData(dbNode: string, subject: string, replyToken: string, token: string | undefined, titlePrefix: string) {
  db.ref(`${dbNode}/${subject}`).once('value')
    .then(function(snapshot) {
      if (snapshot.exists()) {
        const dataList = Object.values(snapshot.val());
        sendFlexMessage(replyToken, token, titlePrefix, dataList);
      } else {
        replyText(replyToken, token, `目前「${subject}」還沒有上傳任何資料喔！`);
      }
    })
    .catch(function(error) { console.error(error); });
}

function sendFlexMessage(replyToken: string, token: string | undefined, titleText: string, items: any[]) {
  const buttons = items.map(function(item: any) {
    return { type: "button", style: "secondary", margin: "sm", height: "sm", action: { type: "uri", label: item.title, uri: item.url } };
  });

  const flexMessage = {
    type: "flex", altText: titleText,
    contents: {
      type: "bubble", size: "kilo",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#0f172a",
        contents: [
          { type: "text", text: titleText, weight: "bold", color: "#ffffff", size: "xl" },
          { type: "text", text: "點擊下方按鈕開啟檔案", color: "#94a3b8", size: "xs", margin: "md" }
        ]
      },
      body: { type: "box", layout: "vertical", spacing: "md", contents: buttons }
    }
  };

  axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [flexMessage] }, { headers: { Authorization: `Bearer ${token}` } }).then(function(){}).catch(function(e){});
}

function replyText(replyToken: string, token: string | undefined, text: string) {
  axios.post('https://api.line.me/v2/bot/message/reply', { replyToken: replyToken, messages: [{ type: 'text', text: text }] }, { headers: { Authorization: `Bearer ${token}` } }).then(function(){}).catch(function(e){});
}

function switchRichMenu(userId: string, menuId: string, token: string | undefined) {
  return axios.post(`https://api.line.me/v2/bot/user/${userId}/richmenu/${menuId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
}
