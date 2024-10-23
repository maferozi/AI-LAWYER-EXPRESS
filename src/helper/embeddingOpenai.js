const { createOpenaiConnection } = require("../config/openai.config");

const openai = createOpenaiConnection();

async function generateEmbedding(inputText) {
  try {
    const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: inputText,
        encoding_format: "float",
      });
    

       JSON.stringify(response, null, 2);

      if (response && response.data && response.data.length > 0) {
        let embedding = response.data[0].embedding;
        console.log('Embedding:', embedding);
        return embedding; 
      } else {
        throw new Error('Invalid response structure from OpenAI API');
      }

  } catch (error) {
      console.error('Error creating embedding:', error.response ? error.response.data : error.message);
  }
}


module.exports = { generateEmbedding };