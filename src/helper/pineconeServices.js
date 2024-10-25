require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const { createPineconeConnection } = require("../config/pinecone.config");
let { loadQAStuffChain } = require("langchain/chains");
let { Document } = require("langchain/document");
const LangchainOpenAI = require("@langchain/openai").OpenAI;

const llm = new LangchainOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const chain = loadQAStuffChain(llm);

const pineconeClient = createPineconeConnection();

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;
const PINECONE_NAMESPACE_NAME = process.env.PINECONE_NAMESPACE_NAME;

async function upsertVector(embedding,text) {
  try {
    const index = pineconeClient.Index(PINECONE_INDEX_NAME);

    await index.namespace('thirstyCrow').upsert(
      [{
        id: uuidv4(),
        values: embedding,
        metadata:{
          text: text
        }
      }]
    );

    console.log("Vector upserted successfully:");
  } catch (error) {
    console.error("Error upserting vector:", error);
    throw new Error("Error upserting vector");
  }
}

async function queryVector(embedding, query, topK = 10) {
  try {
    const index = pineconeClient.Index(PINECONE_INDEX_NAME);

    const queryResponse = await index.namespace(PINECONE_NAMESPACE_NAME).query({
      topK: topK,
      vector: embedding,
      includeMetadata: true,
    });
    
    const concatenatedText = queryResponse.matches
        .map((match) => match.metadata.text)
        .join(" ");
    
      

        const result = await chain.call({
          input_documents: [new Document({ pageContent: concatenatedText })],
          question: query,
      });
      return result.text;
    
  } catch (error) {
    console.error("Error querying vector:", error.message);
    throw new Error("Error querying vector");
  }
}

async function initializeIndex() {
  try {
    const existingIndexes = await pineconeClient.listIndexes();

    if (1) {
      await pineconeClient.createIndex({
        name: PINECONE_INDEX_NAME,
        dimension: 1536,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
      });
      console.log(`Created Pinecone index: ${PINECONE_INDEX_NAME}`);
    } else {
      console.log(`Pinecone index '${PINECONE_INDEX_NAME}' already exists.`);
    }
  } catch (error) {
    console.error("Error initializing index:", error.message);
    throw new Error("Error initializing index");
  }
}

module.exports = {
  upsertVector,
  queryVector,
  initializeIndex,
};

