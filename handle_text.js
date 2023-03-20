async function handle_message_text(bot, openai, body) {
  const text = body.text;
  const chat_dest = body.chat_dest;

  const response = await openai.ChatCompletion.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: text },
    ],
  });

  const content = response.choices[0].message.content;
  bot.telegram.sendMessage(chat_dest, content);
  return 'OK';
}

module.exports = {
  handle_message_text,
};