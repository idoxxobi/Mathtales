import axios from 'axios';
import fs from 'fs';
import path from 'path';

const MODEL_URL = 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf';
const MODEL_DIR = path.join(process.cwd(), 'models');
const MODEL_PATH = path.join(MODEL_DIR, 'model.gguf');

async function downloadModel() {
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }

  if (fs.existsSync(MODEL_PATH)) {
    console.log('Model already exists at:', MODEL_PATH);
    console.log('Delete it manually if you want to re-download.');
    return;
  }

  console.log('Starting Gemma 4 E2B-it (Q8_0) download from Hugging Face (~4.6GB)...');
  console.log('Source:', MODEL_URL);

  try {
    const response = await axios({
      method: 'GET',
      url: MODEL_URL,
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(MODEL_PATH);
    
    let downloadedBytes = 0;
    const totalBytes = parseInt((response.headers['content-length'] || '0') as string);

    response.data.on('data', (chunk: Buffer) => {
      downloadedBytes += chunk.length;
      if (totalBytes > 0) {
        const percent = ((downloadedBytes / totalBytes) * 100).toFixed(2);
        process.stdout.write(`\rDownloading: ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(2)} MB / ${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
      }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('\nDownload complete! Model saved to:', MODEL_PATH);
        resolve(true);
      });
      writer.on('error', (err) => {
        console.error('\nError during download:', err);
        reject(err);
      });
    });
  } catch (error) {
    console.error('Failed to download model:', error);
    process.exit(1);
  }
}

downloadModel();
