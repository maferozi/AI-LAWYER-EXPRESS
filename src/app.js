
const { appConfig } = require("./config/app.config");

appConfig();


// const { OpenAI } = require("openai");

// const openai = new OpenAI({
//   apiKey:
//     "sk-ZDMonYQFqIgOVbO46_pJ9xt-43ECxs_0gART_P5oOlT3BlbkFJrBKp4KrtR3NmI_W5VviWsij5ODgtyL2MTrSYjaceYA",
// });

// async function main() {
//   const embedding = await openai.embeddings.create({
//     model: "text-embedding-ada-002",
//     input: "Your text string goes here",
//     encoding_format: "float",
//   });

//   console.log(embedding.data);
// }

// main();