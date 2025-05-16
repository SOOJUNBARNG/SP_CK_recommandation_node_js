const path = require("path");
const fs = require("fs");

// Require the Fastify framework and instantiate it
const fastify = require("fastify")({
  logger: false,
});

// Serve static files from /public
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // Default is '/'
});

// Parse form and JSON bodies
fastify.register(require("@fastify/formbody"));
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars"),
  },
});

// SEO config
const seo = require("./src/seo.json");
if (seo.url === "glitch-default") {
  seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
}

// Serve the main page
fastify.get("/", function (request, reply) {
  return reply.sendFile("index.html"); // from /public
});

// ✅ Save endpoint for timetable.json
fastify.post("/save", async function (request, reply) {
  const filePath = path.join(__dirname, "public", "timetable.json");

  try {
    await fs.promises.writeFile(filePath, JSON.stringify(request.body, null, 2));
    reply.send("File saved successfully.");
  } catch (err) {
    console.error("Failed to save file:", err);
    reply.status(500).send("Failed to save file.");
  }
});

// Start server
fastify.listen(
  { port: process.env.PORT || 3000, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);
