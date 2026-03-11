const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const key = env.split('GOOGLE_MAPS_API_KEY=')[1].split('\n')[0].trim();
const address = encodeURIComponent('Camino General Belgrano 7287, Gutierrez, Buenos Aires');

https.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${address}&key=${key}&region=ar`, (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => {
    const json = JSON.parse(data);
    console.log(json.results[0].geometry.location);
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
