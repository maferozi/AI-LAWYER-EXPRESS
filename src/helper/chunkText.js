function chunkText(text, minWords) {
    const paragraphs = text.split(/\n+/).map(paragraph => paragraph.trim()).filter(paragraph => paragraph.length > 0);
    
    const chunks = [];
    let currentChunk = [];
  
    paragraphs.forEach(paragraph => {
      const paragraphWordCount = paragraph.split(' ').length;
  
      if (currentChunk.join(' ').split(' ').length + paragraphWordCount >= minWords) {
        currentChunk.push(paragraph);
        chunks.push(currentChunk.join(' ').trim());
        currentChunk = [];
      } else {
        currentChunk.push(paragraph);
      }
    });

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' ').trim());
    }
  
    return chunks;
  }

  function batchEmbeddings(embeddings, batchSize) {
    const batches = [];
    for (let i = 0; i < embeddings.length; i += batchSize) {
      batches.push(embeddings.slice(i, i + batchSize));
    }
    return batches;
  }

  module.exports = {chunkText, batchEmbeddings}