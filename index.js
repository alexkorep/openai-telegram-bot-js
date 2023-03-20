const { Telegraf } = require('telegraf');
const express = require('express');
const AWS = require('aws-sdk');
const openai = require('openai');
const { handle_message_audio_or_voice } = require('./handle_audio');
const { handle_message_text } = require('./handle_text');

const app = express();
const bot = new Telegraf(process.env.TELEGRAM_API_KEY);
const sqs = new AWS.SQS();

app.use(bot.webhookCallback(`/${process.env.TELEGRAM_API_KEY}`));

bot.on(['text', 'audio', 'voice'], async (ctx) => {
  const message = ctx.message;
  const chat_dest = message.chat.id;
  const content_type = message.type;
  const user_username = message.from.username;

  if (!is_allowed_username(user_username)) {
    ctx.reply('Sorry, you are not allowed to use this bot.');
    return;
  }

  ctx.telegram.sendChatAction(chat_dest, 'typing');

  try {
    const body = {
      content_type: content_type,
      chat_dest: chat_dest,
    };

    if (content_type === 'text') {
      body.text = message.text;
    } else if (content_type === 'audio') {
      body.file_id = message.audio.file_id;
      body.duration = message.audio.duration;
    } else if (content_type === 'voice') {
      body.file_id = message.voice.file_id;
      body.duration = message.voice.duration;
    }

    if (process.env.USE_SQS === 'true') {
      send_message_to_queue(body, process.env.SQS_QUEUE_NAME);
    } else {
      handle_message(body);
    }
  } catch (exc) {
    const exception_text = `Error processing message: ${exc}`;
    ctx.reply(exception_text);
  }
});

function is_allowed_username(username) {
  const username_list = process.env.ALLOWED_USERNAMES.split(',');
  return username_list.includes(username);
}

async function send_message_to_queue(msg, queue_name) {
  try {
    const queue = await sqs.getQueueUrl({ QueueName: queue_name }).promise();
    const response = await sqs
      .sendMessage({
        QueueUrl: queue.QueueUrl,
        MessageBody: JSON.stringify(msg),
      })
      .promise();
    return [response.MessageId, response.MD5OfMessageBody];
  } catch (exc) {
    console.error(`Error sending message to queue: ${queue_name}.  Exc: ${exc}`);
  }
}

function process_messages(event) {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    handle_message(body);
  }
}

function handle_message(body) {
  const content_type = body.content_type;
  const chat_dest = body.chat_dest;

  if (content_type === 'text') {
    handle_message_text(bot, openai, body);
  } else if (content_type === 'audio' || content_type === 'voice') {
    handle_message_audio_or_voice(bot, openai, body);
  } else {
    ctx.reply('Sorry, this type of messages is not supported.');
  }
}

app.get('/', (req, res) => {
  res.send(process.env.TELEGRAM_API_KEY && process.env.WEBHOOK_HOST ? 'OK' : 'Not OK');
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});

if (process.env.TELEGRAM_API_KEY && process.env.WEBHOOK_HOST) {
  bot.telegram.getWebhookInfo().then((webhookInfo) => {
    if (webhookInfo.url !== `https://${process.env.WEBHOOK_HOST}/${process.env.TELEGRAM_API_KEY}`) {
      bot.telegram.setWebhook(`https://${process.env.WEBHOOK_HOST}/${process.env.TELEGRAM_API_KEY}`);
    }
  });
}

exports.handler = async (event) => {
  process_messages(event);
};
