import { access, copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const serverOutput = resolve("dist/server/index.js");
const previewEntry = resolve("dist/server/server.js");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(previewEntry))) {
  if (!(await exists(serverOutput))) {
    throw new Error("A build não gerou uma entrada de servidor para o preview.");
  }
  await copyFile(serverOutput, previewEntry);
}
