// Runs as a child process — completely outside webpack's module system
// stdin: base64-encoded PDF buffer
// stdout: JSON { text: string } or { error: string }

const pdfParse = require("pdf-parse");

let data = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  const buffer = Buffer.from(data.trim(), "base64");
  pdfParse(buffer)
    .then((result) => {
      process.stdout.write(JSON.stringify({ text: result.text }));
    })
    .catch((err) => {
      process.stdout.write(JSON.stringify({ error: err.message }));
      process.exit(1);
    });
});
