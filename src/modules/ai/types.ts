export type RetrievedKnowledge = {
  id: string;
  title: string;
  answer: string;
  allowAiRewrite: boolean;
  priority: "normal" | "high" | "critical";
};

// Cuando allowAiRewrite es false, la respuesta futura debe conservar el texto oficial.
export type AnswerRequest = {
  projectId: string;
  question: string;
  matches: RetrievedKnowledge[];
};

export type AnswerResult = {
  text: string;
  usedRewrite: boolean;
  sourceIds: string[];
};
