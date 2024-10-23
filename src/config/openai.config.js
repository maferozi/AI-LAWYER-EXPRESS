const { OpenAI } = require("openai");
require("dotenv").config();


const createOpenaiConnection = () =>{
  try {
    const res = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log("openai connection connected sucessfully");
    return res;
  } catch (error) {
    console.log(error);
  }
}

module.exports = { createOpenaiConnection };
