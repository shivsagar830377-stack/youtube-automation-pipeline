const fs = require('fs');
const http = require('http');
const url = require('url');
const { google } = require('googleapis');

const credentials = JSON.parse(fs.readFileSync('credentials.json'));
const { client_secret, client_id } = credentials.installed || credentials.web;

const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/oauth2callback')) {
      const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
      const code = qs.get('code');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Authentication successful! Termux par wapas jaayein.');
      server.close();
      
      const { tokens } = await oAuth2Client.getToken(code);
      fs.writeFileSync('token.json', JSON.stringify(tokens));
      console.log('\nSuccess! token.json successfully ban chuki hai.');
      process.exit(0);
    }
  } catch (e) {
    res.end('Authentication failed!');
    console.error(e);
    process.exit(1);
  }
}).listen(3000, () => {
  console.log('\n--- Niche diye URL ko copy karke Chrome mein kholein ---\n');
  console.log(authUrl);
  console.log('\n------------------------------------------------------------\n');
});
