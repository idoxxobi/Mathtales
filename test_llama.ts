import { getLlama, LlamaChatSession } from "node-llama-cpp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_PATH = path.join(__dirname, "models", "model.gguf");

async function main() {
  console.log("Loading llama...");
  const llama = await getLlama();
  console.log("Loading model...");
  const model = await llama.loadModel({ modelPath: MODEL_PATH });
  console.log("Creating context...");
  const context = await model.createContext();
  const session = new LlamaChatSession({ contextSequence: context.getSequence() });
  console.log("Prompting...");
  const response = await session.prompt("Hello, what is 2+2? Answer briefly.", {
    onTextChunk: (text) => process.stdout.write(text),
  });
  console.log("\nDone!");
}

main().catch(console.error);
