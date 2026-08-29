// A build proves the code is consistent. It says nothing about whether the packaged artifact can
// start. This starts the zip's entry point the way the runtime does and asks it for a page.
const { join } = require("node:path");

const bundle = join(process.cwd(), "dist", "index.js");
const loaded = require(bundle);

if (typeof loaded.handler !== "function") {
  console.error("the bundle exports no handler");
  process.exit(1);
}

const get = (path, id) => ({
  rawPath: path,
  queryStringParameters: id === undefined ? {} : { id },
  requestContext: { http: { method: "GET", path } },
});

(async () => {
  const front = await loaded.handler(get("/"));
  const bad = await loaded.handler(get("/videos", "nope"));

  console.log(`GET /            -> ${front.statusCode}, ${front.body.length} bytes`);
  console.log(`GET /videos?id=nope -> ${bad.statusCode}, ${bad.body.length} bytes`);

  if (front.statusCode !== 200 || front.body.length < 1000) {
    console.error("the front page did not come back");
    process.exit(1);
  }
  if (bad.statusCode !== 400) {
    console.error("a malformed id did not come back as 400");
    process.exit(1);
  }
  console.log("the package starts and serves");
})().catch((cause) => {
  console.error("the package did not start:", cause);
  process.exit(1);
});
