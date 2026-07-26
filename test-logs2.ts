import fetch from "node-fetch";

async function run() {
  const res = await fetch("http://localhost:3000/api/activity-logs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer TEST_TOKEN_BYPASS"
    },
    body: JSON.stringify({ adminRole: "admin", adminUid: "test" })
  });
  console.log(res.status);
  const text = await res.text();
  console.log(text);
}
run();
