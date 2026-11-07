// workers/types.ts
// Shared discriminated union types for all worker ↔ main-thread communication.
// ArrayBuffer and Float32Array payloads are transferred via the Transferable interface
// for zero-copy message passing.

// ─── Parser Worker Protocol ────────────────────────────────────────────────

export interface ParseDocumentRequest {
  type: 'PARSE_DOCUMENT';
  slug: string;
  fileName: string;
  mimeType: string;
  buffer: ArrayBuffer; // Transferred via Transferable — zero-copy
}

export interface ParseProgressMessage {
  type: 'PARSE_PROGRESS';
  slug: string;
  pagesComplete: number;
  totalPages: number;
  stage: 'parsing';
}

export interface ParsedPage {
  pageNumber: number | null; // 1-indexed for PDFs; null for non-PDF
  lineOffset: number;        // 0-indexed line number of first character on this page/section
  text: string;
}

export interface ParseCompleteMessage {
  type: 'PARSE_COMPLETE';
  slug: string;
  pages: ParsedPage[];
  pageCount: number | null;  // null for non-PDF
  skippedPages: number[];    // 1-indexed page numbers that were corrupt/unreadable
}

export type ParserErrorCode =
  | 'PASSWORD_PROTECTED'
  | 'CORRUPT_FILE'
  | 'UNSUPPORTED_FORMAT'
  | 'UNKNOWN';

export interface ParseErrorMessage {
  type: 'PARSE_ERROR';
  slug: string;
  errorCode: ParserErrorCode;
  message: string;
}

export type ParserWorkerRequest = ParseDocumentRequest;

export type ParserWorkerMessage =
  | ParseProgressMessage
  | ParseCompleteMessage
  | ParseErrorMessage;

// ─── Embeddings Worker Protocol ────────────────────────────────────────────

export interface ChunkDocumentRequest {
  type: 'CHUNK_DOCUMENT';
  slug: string;
  pages: ParsedPage[];
  maxTokens?: number;        // Default: 512
  overlapTokens?: number;    // Default: 50
}

export interface ChunkedOutput {
  chunkId: string;
  documentId: string;        // slug
  text: string;
  pageNumber: number | null;
  lineOffset: number | null;
  tokenCount: number;
  truncated: boolean;
  chunkIndex: number;        // 0-based position within document
}

export interface ChunkCompleteMessage {
  type: 'CHUNK_COMPLETE';
  slug: string;
  chunks: ChunkedOutput[];
}

export interface EmbedChunkRequest {
  type: 'EMBED_CHUNK';
  chunkId: string;
  text: string;
}

export interface EmbedQueryRequest {
  type: 'EMBED_QUERY';
  requestId: string;         // UUID — used to correlate async responses
  queryText: string;
}

export interface EmbedCompleteMessage {
  type: 'EMBED_COMPLETE';
  chunkId?: string;          // Present for EMBED_CHUNK responses
  requestId?: string;        // Present for EMBED_QUERY responses
  vector: Float32Array;      // 384-dimensional lexical feature vector, Transferable
}

export type EmbedErrorCode =
  | 'MODEL_NOT_LOADED'
  | 'INFERENCE_FAILED'
  | 'TIMEOUT'
  | 'UNKNOWN';

export interface EmbedErrorMessage {
  type: 'EMBED_ERROR';
  chunkId?: string;
  requestId?: string;
  errorCode: EmbedErrorCode;
  message: string;
}

export interface ModelLoadProgressMessage {
  type: 'MODEL_LOAD_PROGRESS';
  progress: number;          // 0–100
  status: string;            // Human-readable status e.g. 'Loading model weights...'
}

export interface ModelReadyMessage {
  type: 'MODEL_READY';
}

export type EmbeddingsWorkerRequest =
  | ChunkDocumentRequest
  | EmbedChunkRequest
  | EmbedQueryRequest;

export type EmbeddingsWorkerMessage =
  | ChunkCompleteMessage
  | EmbedCompleteMessage
  | EmbedErrorMessage
  | ModelLoadProgressMessage
  | ModelReadyMessage;
