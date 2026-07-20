import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const serverOutput = resolve("dist/server/index.js");
const previewEntry = resolve("dist/server/server.js");

await copyFile(serverOutput, previewEntry);
