import type { Alert, ChannelConfig } from '../types.js';

/**
 * Telegram Bot API delivery. Free, no signup beyond BotFather setup.
 * The bot only needs to know the user's chat_id (user sends /start
 * to the bot once to capture it).
 *
 * Founder ops: register the bot via @BotFather on Telegram, set
 * TELEGRAM_BOT_TOKEN env, then any user can /start and receive their
 * chat_id back from /notifier/onboard.
 */
export async function deliverTelegram(alert: Alert, config: ChannelConfig): Promise<void> {
  if (!config.telegramChatId) throw new Error('telegramChatId missing');
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[notifier] TELEGRAM_BOT_TOKEN not set; skipping telegram delivery');
    return;
  }

  const text = formatTelegramMarkdown(alert);
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: false,
    }),
  });
  if (!r.ok) {
    throw new Error(`telegram_${r.status}: ${await r.text()}`);
  }
}

function formatTelegramMarkdown(alert: Alert): string {
  const sevEmoji = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵';
  // MarkdownV2 escapes; bare-bones since we control the input strings.
  const esc = (s: string) => s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  const lines = [
    `${sevEmoji} *${esc(alert.title)}*`,
    '',
    esc(alert.body),
  ];
  if (alert.link) {
    lines.push('', `[View on Arbiscan](${alert.link})`);
  }
  if (alert.txHash) {
    lines.push('', `tx \`${esc(alert.txHash.slice(0, 10))}\\.\\.\\.${esc(alert.txHash.slice(-4))}\``);
  }
  return lines.join('\n');
}
