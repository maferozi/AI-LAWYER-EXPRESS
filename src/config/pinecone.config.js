require('dotenv').config();
const { Pinecone } = require("@pinecone-database/pinecone");


function createPineconeConnection(){
    try {
        const res = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        console.log('PineCone connection connected sucessfully');
        return res
        
    } catch (error) {
        console.log(error);
    }
}

module.exports = { createPineconeConnection};