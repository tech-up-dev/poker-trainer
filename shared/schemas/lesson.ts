import { z } from "zod";

export const AnswerSchema = z.object({
  text: z.string().min(1, "Answer text is required"),
  is_correct: z.boolean(),
  explanation: z
    .string({ error: "Explanation is required for every answer" })
    .min(1, "Explanation is required for every answer"),
});

export const QuestionSchema = z.object({
  question_id: z
    .string({ error: "question_id is required" })
    .min(1, "question_id is required"),
  type: z.enum(["multiple_choice", "hand_scenario"], {
    error: () => "type must be either 'multiple_choice' or 'hand_scenario'",
  }),
  prompt: z.string().min(1, "Question prompt is required"),
  answers: z
    .array(AnswerSchema)
    .length(4, "Each question must have exactly 4 answers")
    .refine(
      (arr) => arr.filter((a) => a.is_correct).length === 1,
      { message: "Exactly one answer must have is_correct=true" }
    ),
  table_state: z.unknown().optional(),
  glossary_terms: z.array(z.string()).optional(),
});

export const LessonSchema = z.object({
  lesson_id: z.string().min(1, "lesson_id is required"),
  title: z.string().min(1, "title is required"),
  principle_tag: z.string().min(1, "principle_tag is required"),
  questions: z
    .array(QuestionSchema)
    .min(1, "A lesson must contain at least one question"),
});

export type Lesson = z.infer<typeof LessonSchema>;
