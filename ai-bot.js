const fs = require('fs');
const { execSync } = require('child_process');
const { google } = require('googleapis');

// 1. YouTube OAuth2 Setup
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

// 2. ओरिजिनल HD पोस्टर और ऑडियो फेच
function fetchSongAndPoster(query) {
  console.log(`\n1. गाना और ओरिजिनल पोस्टर फेच हो रहा है: "${query}"...`);
  const finalAudio = 'track.mp3';

  if (fs.existsSync('track.mp3')) fs.unlinkSync('track.mp3');
  if (fs.existsSync('poster.jpg')) fs.unlinkSync('poster.jpg');
  if (fs.existsSync('thumbnail.jpg')) fs.unlinkSync('thumbnail.jpg');

  // yt-dlp से बेस्ट ऑडियो और मैक्सिमम क्वालिटी थंबनेल
  const cmd = `yt-dlp --extractor-args "youtube:player_client=android" -x --audio-format mp3 --write-thumbnail --convert-thumbnails jpg --default-search "ytsearch1:" -o "song.%(ext)s" "${query}"`;
  execSync(cmd, { stdio: 'inherit' });

  // डाउनलोड हुए थंबनेल को 1920x1080 पोस्टर में बदलना
  const downloadedThumb = fs.readdirSync('.').find(f => f.startsWith('song.') && (f.endsWith('.jpg') || f.endsWith('.webp') || f.endsWith('.png')));
  if (downloadedThumb) {
    execSync(`ffmpeg -y -i "${downloadedThumb}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black" poster.jpg`, { stdio: 'ignore' });
    execSync(`ffmpeg -y -i poster.jpg -vf "scale=1280:720" thumbnail.jpg`, { stdio: 'ignore' });
    console.log('✓ ओरिजिनल HD पोस्टर तैयार हो गया!');
  }

  const downloadedAudio = fs.readdirSync('.').find(f => f.startsWith('song.') && f.endsWith('.mp3'));
  if (downloadedAudio) {
    fs.renameSync(downloadedAudio, finalAudio);
  }

  return finalAudio;
}

// 3. पोस्टर इंट्रो (शुरुआती 4 सेकंड) + 3D विजुअलाइज़र
function createVideoWithPosterIntro(audioPath) {
  console.log('\n2. ओरिजिनल पोस्टर इंट्रो के साथ वीडियो बन रहा है...');
  const bgPath = 'background.mp4';
  const outputPath = 'final_video.mp4';

  if (!fs.existsSync(bgPath)) throw new Error('background.mp4 नहीं मिला!');
  if (!fs.existsSync('poster.jpg')) throw new Error('poster.jpg नहीं मिला!');
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  // पोस्टर 0 से 4 सेकंड तक रहेगा (3 से 4 सेकंड के बीच स्मूथली फ़ेड होकर विजुअलाइज़र में जाएगा)
  const filter = `[0:v]fade=t=out:st=3:d=1[poster];[1:v][poster]overlay=0:0:enable='lte(t,4)'[v]`;

  const cmd = `ffmpeg -y -loop 1 -i poster.jpg -stream_loop -1 -i "${bgPath}" -i "${audioPath}" -filter_complex "${filter}" -map "[v]" -map 2:a:0 -c:v libx264 -preset ultrafast -c:a aac -b:a 192k -shortest "${outputPath}"`;
  execSync(cmd, { stdio: 'inherit' });

  // वीडियो और थंबनेल को अपने आप फ़ोन के Download फ़ोल्डर में कॉपी करना
  try {
    execSync(`cp "${outputPath}" /sdcard/Download/Latest_Song_Video.mp4`, { stdio: 'ignore' });
    execSync(`cp thumbnail.jpg /sdcard/Download/Latest_Thumbnail.jpg`, { stdio: 'ignore' });
    execSync(`am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/Latest_Song_Video.mp4`, { stdio: 'ignore' });
    execSync(`am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/Latest_Thumbnail.jpg`, { stdio: 'ignore' });
    console.log('✓ वीडियो और पोस्टर फ़ोन के Download फ़ोल्डर में सेव हो गए!');
  } catch (e) {
    // इग्नोर करें अगर परमिशन एरर आए
  }

  return outputPath;
}

// 4. समय स्लॉट
function getNextSlotTime(preference) {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istNow = new Date(utc + (3600000 * 5.5));
  let targetIST = new Date(istNow);

  if (preference === 'morning') {
    if (istNow.getHours() >= 6) targetIST.setDate(targetIST.getDate() + 1);
    targetIST.setHours(6, 0, 0, 0);
  } else if (preference === 'evening') {
    if (istNow.getHours() >= 18) targetIST.setDate(targetIST.getDate() + 1);
    targetIST.setHours(18, 0, 0, 0);
  } else {
    const todayMorning = new Date(istNow); todayMorning.setHours(6, 0, 0, 0);
    const todayEvening = new Date(istNow); todayEvening.setHours(18, 0, 0, 0);
    if (istNow < todayMorning) targetIST = todayMorning;
    else if (istNow < todayEvening) targetIST = todayEvening;
    else { targetIST.setDate(targetIST.getDate() + 1); targetIST.setHours(6, 0, 0, 0); }
  }

  const targetUTC = new Date(targetIST.getTime() - (3600000 * 5.5));
  return {
    isoUTC: targetUTC.toISOString(),
    displayIST: targetIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })
  };
}

// 5. YouTube Upload
async function uploadToYouTube(videoPath, title, slotPreference) {
  console.log(`\n3. YouTube अपलोड प्रक्रिया...`);
  const fileSize = fs.statSync(videoPath).size;
  const slot = getNextSlotTime(slotPreference);
  console.log(`⏰ तय शेड्यूल समय: ${slot.displayIST}`);

  const res = await youtube.videos.insert(
    {
      part: 'id,snippet,status',
      requestBody: {
        snippet: {
          title: `${title} | Smart Music Vibes`,
          description: `${title}\n\n🎧 Smart Music Vibes Visualizer\n\n#SmartMusicVibes #MusicVisualizer #TrendingSong`,
          tags: ['Smart Music Vibes', 'Visualizer', 'Music', 'Trending'],
          categoryId: '10'
        },
        status: {
          privacyStatus: 'private',
          publishAt: slot.isoUTC
        }
      },
      media: { body: fs.createReadStream(videoPath) }
    },
    {
      onUploadProgress: (evt) => {
        const progress = (evt.bytesRead / fileSize) * 100;
        process.stdout.write(`Upload progress: ${Math.round(progress)}%\r`);
      }
    }
  );

  const videoId = res.data.id;
  console.log(`\n✓ वीडियो ID: ${videoId}`);

  if (fs.existsSync('thumbnail.jpg')) {
    try {
      await youtube.thumbnails.set({
        videoId: videoId,
        media: { body: fs.createReadStream('thumbnail.jpg') }
      });
      console.log('✓ ओरिजिनल HD थंबनेल YouTube पर सेट हो गया!');
    } catch (e) {
      console.log('नोट: थंबनेल ऑटो-अपलोड नहीं हो सका (वेरिफिकेशन पेंडिंग):', e.message);
    }
  }

  console.log(`🎉 वीडियो शेड्यूल हो गया: https://youtu.be/${videoId}`);
}

async function main() {
  const songQuery = process.argv[2] || "Dev Ke Dulari Pawan Singh";
  const slotPreference = process.argv[3] || "evening";
  try {
    const audio = fetchSongAndPoster(songQuery);
    const video = createVideoWithPosterIntro(audio);
    await uploadToYouTube(video, songQuery, slotPreference);
  } catch (err) {
    console.error('\nError:', err.message);
  }
}

main();
