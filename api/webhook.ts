// === 發送旗艦質感 Flex Message ===
function sendFlexMessage(replyToken: string, token: string | undefined, titleText: string, items: any[]) {
  // 把每個檔案變成一個漂亮且可點擊的列表區塊 (取代傳統醜按鈕)
  const listItems = items.map(function(item: any) {
    return {
      type: "box",
      layout: "horizontal",
      spacing: "md",
      paddingAll: "16px",
      cornerRadius: "16px",
      backgroundColor: "#f8fafc", // 極簡淡灰底色
      action: { type: "uri", label: "開啟檔案", uri: item.url },
      contents: [
        { type: "text", text: "📄", flex: 0, size: "md", gravity: "center" },
        { type: "text", text: item.title, weight: "bold", color: "#334155", size: "sm", gravity: "center", wrap: true }
      ]
    };
  });

  const flexMessage = {
    type: "flex",
    altText: titleText,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "0px",
        contents: [
          // 頂部 Header 區塊 (深邃藍黑漸層感)
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#0f172a",
            paddingAll: "24px",
            contents: [
              { type: "text", text: "Smart Education", color: "#94a3b8", size: "xs", weight: "bold" },
              { type: "text", text: titleText, color: "#ffffff", size: "xxl", weight: "bold", margin: "sm" }
            ]
          },
          // 底部檔案列表區塊
          {
            type: "box",
            layout: "vertical",
            paddingAll: "24px",
            spacing: "md",
            contents: listItems.length > 0 ? listItems : [
              { type: "text", text: "此分類目前暫無檔案", color: "#94a3b8", size: "sm", align: "center" }
            ]
          }
        ]
      }
    }
  };

  return axios.post('https://api.line.me/v2/bot/message/reply', { 
    replyToken: replyToken, messages: [flexMessage] 
  }, { headers: { Authorization: `Bearer ${token}` } });
}
