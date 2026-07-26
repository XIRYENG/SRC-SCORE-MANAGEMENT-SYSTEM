import fetch from "node-fetch";

async function run() {
  const res = await fetch("http://localhost:3000/api/activity-logs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer fake-token-that-will-fail-admin-sdk"
    },
    body: JSON.stringify({ adminRole: "admin" })
  });
  console.log(res.status);
  const text = await res.text();
  console.log(text);
}
run();
