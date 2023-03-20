const openai = require('openai');
const axios = require('axios');
const fs = require('fs');
const util = require('util');
const { exec } = require('child_process');
const execAsync = util.promisify(exec);

const tempy = import('tempy');
const path = require('path');

const MAX_DURATION = 60 * 1; // 1 minute

async function handle_message_audio_or_voice(bot, openai, body) {
  const file_id = body.file_id;
  const file_url = await bot.telegram.getFileLink(file_id);
  const chat_dest = body.chat_dest;
  const duration = body.duration;

  if (duration > MAX_DURATION) {
    bot.telegram.sendMessage(
      chat_dest,
      `Audio file too long, should be less than ${MAX_DURATION} seconds`,
    );
    return '';
  }

  try {
    const temp_dir = tempy.directory();
    const temp_file_name = path.join(temp_dir, 'temp.mp3');

    await execAsync(
      `ffmpeg -i ${file_url} -vn -y -ar 44100 -ac 2 -b:a 192k ${temp_file_name}`,
    );

    const audio_file = fs.createReadStream(temp_file_name);
    const transcript = await openai.Audio.transcribe('whisper-1', audio_file);
    console.log('transcript: ', transcript.text);
    bot.telegram.sendMessage(chat_dest, transcript.text);
  } catch (exc) {
    console.error(`Error converting audio file: ${exc}`);
    bot.telegram.sendMessage(chat_dest, 'Error converting audio file');
  }

  return 'OK';
}

module.exports = {
  handle_message_audio_or_voice,
};