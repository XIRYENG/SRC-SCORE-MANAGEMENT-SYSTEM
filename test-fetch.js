const http = require('http');

http.get('http://localhost:3000/api/all-users', (resp) => {
  let data = '';
  resp.on('data', (chunk) => {
    data += chunk;
  });
  resp.on('end', () => {
    console.log(data.substring(0, 500));
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
