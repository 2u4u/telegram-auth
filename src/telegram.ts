const LOGIN_MESSAGE_ENDPOINT = 'http://mssge.ru/api/send-message';

export async function sendTelegramMessage(_botToken: string | undefined, _chatId: string, text: string): Promise<boolean> {
  try {
    const resp = await fetch(LOGIN_MESSAGE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    if (!resp.ok) {
      console.error('[telegram-auth] login message API error:', resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[telegram-auth] Failed to send login message:', err);
    return false;
  }
}

function formatLoginMessage(appName: string, loginUrl: string, ip: string, ua: string, geo: string): string {
  return [
    `🔐 ${appName} login link`,
    '',
    loginUrl,
    '',
    'Valid for 2 hours. One-time use.',
    '',
    `📍 IP: ${ip}${geo ? ` (${geo})` : ''}`,
    `🌐 ${ua}`,
  ].join('\n');
}

/**
 * Sends a chat-bound login link to each chatId. The URL is built per-chat via
 * `buildLoginUrl`, so each recipient's session, when created, carries that
 * specific chatId.
 */
export async function broadcastLoginLink(
  botToken: string | undefined,
  chatIds: string[],
  appName: string,
  buildLoginUrl: (chatId: string) => string,
  ip: string,
  ua: string,
  geo: string,
): Promise<number> {
  let sent = 0;
  for (const chatId of chatIds) {
    const text = formatLoginMessage(appName, buildLoginUrl(chatId), ip, ua, geo);
    if (await sendTelegramMessage(botToken, chatId, text)) sent++;
  }
  return sent;
}
