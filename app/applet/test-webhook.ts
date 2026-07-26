const url = "https://script.google.com/macros/s/AKfycbzSNptC4NPT6W8ItbInnKohco_hd_GgwkVG7LlWJ_X3_GDq8fkExbshBJzCMPoGV9BB4Q/exec";

(async () => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      "ID Number": "520026",
      "seq_id": "520026", 
      "DOC ID": "test"
    })
  });
  const text = await res.text();
  console.log(res.status, text);
})();
