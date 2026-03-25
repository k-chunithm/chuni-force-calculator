const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Node' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', e => reject(e));
  });
}

async function run() {
  const PROXY = 'https://chunirec-proxy.k-chunithm.workers.dev/users';
  const json = await fetchJson(PROXY);
  const users = json.data.filter(u => u.rating && parseFloat(u.rating) > 0);

  function getClassInfo(force) {
    if (force < 10.0) return { class: 1, stars: force < 2.5 ? 1 : force < 5.0 ? 2 : force < 7.5 ? 3 : 4 };
    if (force < 12.0) return { class: 2, stars: force < 10.5 ? 1 : force < 11.0 ? 2 : force < 11.5 ? 3 : 4 };
    if (force < 14.0) return { class: 3, stars: force < 12.5 ? 1 : force < 13.0 ? 2 : force < 13.5 ? 3 : 4 };
    if (force < 15.0) return { class: 4, stars: force < 14.25 ? 1 : force < 14.5 ? 2 : force < 14.75 ? 3 : 4 };
    if (force < 16.0) return { class: 5, stars: force < 15.25 ? 1 : force < 15.5 ? 2 : force < 15.75 ? 3 : 4 };
    if (force < 17.0) return { class: 6, stars: force < 16.25 ? 1 : force < 16.5 ? 2 : force < 16.75 ? 3 : 4 };
    if (force < 18.0) return { class: 7, stars: force < 17.25 ? 1 : force < 17.5 ? 2 : force < 17.75 ? 3 : 4 };
    if (force < 19.0) return { class: 8, stars: force < 18.25 ? 1 : force < 18.5 ? 2 : force < 18.75 ? 3 : 4 };
    if (force < 20.0) return { class: 9, stars: force < 19.25 ? 1 : force < 19.5 ? 2 : force < 19.75 ? 3 : 4 };
    return { class: 10, stars: force < 21.0 ? 1 : force < 22.0 ? 2 : force < 23.0 ? 3 : 4 };
  }

  const stats = {};
  users.forEach(u => {
    const info = getClassInfo(u.value);
    const key = `Class ${info.class.toString().padStart(2, '0')} Star ${info.stars}`;
    if (!stats[key]) stats[key] = [];
    stats[key].push(parseFloat(u.rating));
  });

  const classStats = {};
  users.forEach(u => {
    const info = getClassInfo(u.value);
    const key = `Class ${info.class.toString().padStart(2, '0')}`;
    if (!classStats[key]) classStats[key] = [];
    classStats[key].push(parseFloat(u.rating));
  });

  console.log("=== Statistics by Class & Star ===");
  const keys = Object.keys(stats).sort().reverse();
  for (const key of keys) {
    const arr = stats[key];
    if (arr && arr.length > 0) {
      arr.sort((a, b) => a - b);
      const min = arr[0];
      const max = arr[arr.length - 1];
      const avg = (arr.reduce((a,b)=>a+b,0) / arr.length).toFixed(2);
      const p10 = arr[Math.floor(arr.length * 0.1)];
      const p90 = arr[Math.floor(arr.length * 0.9)];
      console.log(`${key}: Count ${arr.length.toString().padStart(3, ' ')} | Min ${min.toFixed(2)} | P10 ${p10.toFixed(2)} | P90 ${p90.toFixed(2)} | Max ${max.toFixed(2)} | Avg ${avg}`);
    }
  }

  console.log("\n=== Statistics by Class ===");
  const cKeys = Object.keys(classStats).sort().reverse();
  for (const key of cKeys) {
    const arr = classStats[key];
    if (arr && arr.length > 0) {
      arr.sort((a, b) => a - b);
      const min = arr[0];
      const max = arr[arr.length - 1];
      const avg = (arr.reduce((a,b)=>a+b,0) / arr.length).toFixed(2);
      const p10 = arr[Math.floor(arr.length * 0.1)];
      const p90 = arr[Math.floor(arr.length * 0.9)];
      console.log(`${key}: Count ${arr.length.toString().padStart(3, ' ')} | Min ${min.toFixed(2)} | P10 ${p10.toFixed(2)} | P90 ${p90.toFixed(2)} | Max ${max.toFixed(2)} | Avg ${avg}`);
    }
  }
}

run();
