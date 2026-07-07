# AI Lawyer — Backend (Express API)

The backend API for **AI Lawyer**, a Retrieval-Augmented Generation (RAG) legal assistant. It authenticates users, stores conversation history, and answers legal questions by combining OpenAI embeddings, a Pinecone vector database, and LangChain's QA chain over a base of legal reference documents. It's built to be consumed by the [AI Lawyer React frontend](https://github.com/maferozi/AI-LAWYER-REACT).

## Overview

Legal reference documents (e.g. penal codes, investigation handbooks) are chunked, embedded with OpenAI, and stored in Pinecone. When a user asks a question, the backend embeds the question, retrieves the most relevant chunks from Pinecone, and feeds them — along with the question — into a LangChain "stuff" QA chain backed by an OpenAI LLM to produce a grounded answer. Every question and answer is persisted to PostgreSQL as part of a chat history tied to the user.

## Features

- **JWT authentication** — register and login with hashed passwords (bcrypt), protected routes via a bearer-token middleware.
- **Retrieval-Augmented Generation (RAG)** — semantic search over a Pinecone vector index of embedded legal text, with answers generated via LangChain + OpenAI rather than the LLM answering from memory alone.
- **PDF ingestion pipeline** — reads a legal PDF from disk, extracts its text, splits it into word-count-based chunks, embeds each chunk, and upserts the vectors into Pinecone in batches.
- **Conversation persistence** — each question/answer pair is saved as `Message` records under a `Chat`, so users can revisit past conversations; new chats are auto-titled from the first question.
- **Chat history endpoints** — list all of a user's chats, or fetch the full message history for a specific chat.
- **Input validation** — `express-validator` rules enforcing username/email/password rules on registration.

## Tech Stack

- **Runtime/Framework:** Node.js, Express 4
- **Database/ORM:** PostgreSQL, Sequelize
- **AI/RAG:** OpenAI API (`text-embedding-ada-002` embeddings + LLM), LangChain (`loadQAStuffChain`), Pinecone (serverless vector index)
- **Auth:** jsonwebtoken, bcrypt/bcryptjs
- **File/PDF handling:** multer, pdf-parse
- **Validation:** express-validator

## Project Structure

```
src/
├── app.js                        # Entry point
├── config/
│   ├── app.config.js             # Express app setup, model associations, server bootstrap
│   ├── db.config.js              # Sequelize/PostgreSQL connection
│   ├── openai.config.js          # OpenAI client setup
│   └── pinecone.config.js        # Pinecone client setup
├── controller/
│   ├── auth.controller.js        # register, login, me
│   └── embedding.controller.js   # embedding create/search, PDF ingestion, chat history
├── helper/
│   ├── chunkText.js               # Splits raw text into word-count-based chunks; batches vectors
│   ├── embeddingOpenai.js         # Generates embeddings via OpenAI
│   ├── jwt.js                      # Sign/verify/decode JWTs
│   └── pineconeServices.js        # Upsert/query vectors, LangChain QA chain, index initialization
├── middleware/
│   └── authenticateToken.js      # JWT auth middleware
├── models/
│   ├── User.js                   # User model
│   ├── Chat.js                   # Chat (conversation) model
│   └── Message.js                # Message model (prompt/response, belongs to a Chat)
├── routes/
│   ├── index.js                   # Route mounting (/auth, /embedding, /migration)
│   ├── auth.js                    # Auth routes
│   ├── embedding.js               # Embedding/chat routes
│   ├── putMigration.js           # One-off table sync/migration route
│   └── validation/auth.js        # express-validator rules for register/login
├── handbookOfCriminalInvestigation.pdf   # Sample legal reference document (source for embeddings)
└── pakistanPenalCode.pdf                  # Sample legal reference document (source for embeddings)
```

## Data Model

| Model | Purpose |
|---|---|
| `User` | Registered accounts (username, email, hashed password). |
| `Chat` | A conversation, belongs to a `User`, with an auto-generated `chatTitle`. |
| `Message` | A single prompt or response within a `Chat`, typed via `messageType` (`prompt` / `response`). |

Vector embeddings themselves live in **Pinecone**, not PostgreSQL — Postgres only stores the conversation transcript.

## API Reference

All routes are mounted under `/api`.

### Auth — `/api/auth`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/test` | No | Health check for the auth router |
| POST | `/register` | No | Register a new user |
| POST | `/login` | No | Log in, receive a JWT |
| GET | `/me` | Yes | Get the current authenticated user |

### Embedding / Chat — `/api/embedding`
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/search` | Yes | Ask a question — embeds it, retrieves relevant chunks from Pinecone, runs the QA chain, saves the prompt/response as `Message`s, and returns the answer |
| POST | `/upsert` | Yes | Embed arbitrary text entries and store them in Pinecone |
| POST | `/getMessage` | Yes | Get all messages for a given `chatId` |
| GET | `/getAllChats` | Yes | List all chats belonging to the current user |
| POST | `/testSearch` | No | Same as `/search` but without persisting to a chat (testing/debugging) |
| POST | `/uploadPdf` | No | Ingest a PDF from disk: extract text, chunk it, embed each chunk, and upsert into Pinecone |

### Migration — `/api/migration`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/start` | Force-syncs (recreates) the `User`, `Chat`, and `Message` tables — intended for initial setup only |

Protected routes require a `Bearer <token>` JWT in the `Authorization` header.

## RAG Pipeline

1. **Ingestion (`/uploadPdf`):** a legal PDF is read from disk and its text extracted with `pdf-parse`. The text is split into chunks (by word count) via `chunkText`, each chunk is embedded with OpenAI's `text-embedding-ada-002`, and the resulting vectors (with the chunk text as metadata) are upserted into a Pinecone index in batches of 100.
2. **Query (`/search`):** the user's question is embedded the same way, then Pinecone is queried for the top-K most similar chunks. The matched chunks are concatenated and passed — together with the question — into a LangChain `loadQAStuffChain`, which prompts an OpenAI LLM to produce a grounded answer.
3. **Persistence:** the question and answer are saved as two `Message` rows under a `Chat` (created on the first message of a new conversation, titled from that first question).

## Getting Started

### Prerequisites

- Node.js
- PostgreSQL
- An OpenAI API key
- A Pinecone account/API key with a serverless index (or let `initializeIndex` create one)

### Installation

```bash
git clone https://github.com/maferozi/AI-LAWYER-EXPRESS.git
cd AI-LAWYER-EXPRESS
npm install
```

### Environment Variables

Copy `.env_example` to `.env` and fill in the values:

```env
PORT=3000

DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=
DB_DATABASE=
DB_DIALECT=postgres

JWT_SECRET_KEY=
JWT_EXPIRATION=1h

OPENAI_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX_NAME=
PINECONE_NAMESPACE_NAME=
```

| Variable | Description |
|---|---|
| `PORT` | Port the server listens on |
| `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT` / `DB_DATABASE` / `DB_DIALECT` | PostgreSQL connection settings (dialect should be `postgres`) |
| `JWT_SECRET_KEY` / `JWT_EXPIRATION` | JWT signing secret and token lifetime |
| `OPENAI_API_KEY` | OpenAI API key, used for embeddings and the QA chain LLM |
| `PINECONE_API_KEY` | Pinecone API key |
| `PINECONE_INDEX_NAME` | Name of the Pinecone index storing legal document embeddings |
| `PINECONE_NAMESPACE_NAME` | Pinecone namespace used when querying/upserting vectors |

### Database Setup

Run the migration route once against a running server to create the `User`, `Chat`, and `Message` tables:

```
GET /api/migration/start
```

(Alternatively, add Sequelize CLI migrations for a more conventional setup.)

### Seeding the Knowledge Base

Ingest a legal reference PDF (e.g. the included `pakistanPenalCode.pdf`) into Pinecone:

```
POST /api/uploadPdf
Body: { "pdfName": "pakistanPenalCode.pdf", "chunkSize": 300 }
```

### Run in development

```bash
npm run dev
```

## Related Repository

- Frontend: [AI-LAWYER-REACT](https://github.com/maferozi/AI-LAWYER-REACT)

## License

No license specified.
