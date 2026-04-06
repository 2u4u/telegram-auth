export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<boolean> {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!resp.ok) {
      console.error(`[telegram-auth] Telegram API error for chat ${chatId}:`, resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[telegram-auth] Failed to send to chat ${chatId}:`, err);
    return false;
  }
}

export async function broadcastLoginLink(
  botToken: string,
  chatIds: string[],
  appName: string,
  loginUrl: string,
  ip: string,
  ua: string,
  geo: string,
): Promise<number> {
  const lines = [
    `🔐 ${appName} login link`,
    '',
    loginUrl,
    '',
    'Valid for 2 hours. One-time use.',
    '',
    `📍 IP: ${ip}${geo ? ` (${geo})` : ''}`,
    `🌐 ${ua}`,
  ];
  const text = lines.join('\n');

  let sent = 0;
  for (const chatId of chatIds) {
    if (await sendTelegramMessage(botToken, chatId, text)) sent++;
  }
  return sent;
}
