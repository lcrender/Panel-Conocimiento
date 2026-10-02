export type AnswerStatus = "answered" | "no_answer" | "clarification_needed" | "conflicting_information";
export type AnswerConfidence = "high" | "medium" | "low";

export type AnswerSource = {
  id: string;
  title: string;
  question: string;
  answer: string;
  categoryName: string | null;
  priority: "normal" | "high" | "critical";
  allowAiRewrite: boolean;
  similarity: number | null;
  keywords: string[];
};

export type AnswerGenerationInput = {
  apiKey: string;
  userMessage: string;
  systemPrompt: string;
  model: string;
  temperature: number;
};

export type RawModelAnswer = {
  status: AnswerStatus;
  answer: string;
  usedKnowledgeIds: string[];
  conflictingKnowledgeIds: string[];
  confidence: AnswerConfidence;
};

export type GeneratedAnswer = RawModelAnswer & {
  model: string | null;
  durationMs: number;
};

export interface AIProvider {
  readonly name: string;
  generateEmbedding(input: string, apiKey: string): Promise<number[]>;
  generateAnswer(input: AnswerGenerationInput): Promise<RawModelAnswer>;
}

export type ProjectAgentSettings = {
  projectId: string;
  embeddingModel: string;
  answerModel: string;
  temperature: number;
  similarityThreshold: number;
  maxResults: number;
  systemPrompt: string;
};
