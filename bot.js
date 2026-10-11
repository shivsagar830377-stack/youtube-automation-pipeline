const fs = require('fs');
const { google } = require('googleapis');

const credentials = JSON.parse(fs.readFileSync('credentials.json'));
const token = JSON.parse(fs.readFileSync('token.json'));

const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris ? redirect_uris[0] : 'http://localhost:3000/oauth2callback'
);
oAuth2Client.setCredentials(token);

const youtube = google.youtube({
  version: 'v3',
  auth: oAuth2Client
});

async function uploadVideo(filePath, title, description, tags = []) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`File nahi mili: ${filePath}`);
      return;
    }

    console.log(`Uploading shuru ho raha hai: ${title}...`);
    const fileSize = fs.statSync(filePath).size;

    const res = await youtube.videos.insert(
      {
        part: 'id,snippet,status',
        notifySubscribers: false,
        requestBody: {
          snippet: {
            title: title,
            description: description,
            tags: tags,
            categoryId: '10' // 10 = Music Category
          },
          status: {
            privacyStatus: 'private' // Safety ke liye pehle private upload hoga
          }
        },
        media: {
          body: fs.createReadStream(filePath)
        }
      },
      {
        onUploadProgress: (evt) => {
          const progress = (evt.bytesRead / fileSize) * 100;
          process.stdout.write(`Progress: ${Math.round(progress)}%\r`);
        }
      }
    );

    console.log(`\nSuccess! Video upload ho gaya.`);
    console.log(`Video ID: ${res.data.id}`);
    console.log(`Link: https://youtu.be/${res.data.id}`);
  } catch (error) {
    console.error('\nUpload error details:', error.response ? JSON.stringify(error.response.data, null, 2) : error);
  }
}

// Command line argument se file upload karne ke liye:
const args = process.argv.slice(2);
if (args.length > 0) {
  const file = args[0];
  const title = args[1] || 'Music Bot Upload';
  const desc = args[2] || 'Uploaded via Termux Music Bot';
  uploadVideo(file, title, desc);
} else {
  console.log('Bot ready hai! Run karne ka tarika:');
  console.log('node bot.js <video-file-path> "<Video Title>" "<Description>"');
}
