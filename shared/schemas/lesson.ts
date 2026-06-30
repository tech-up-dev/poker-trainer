import { z } from "zod";

export const AnswerSchema = z.object({
  text: z
    .string({ error: "Answer text is required" })
    .min(1, "Answer text is required"),
  is_correct: z.boolean(),
  explanation: z
    .string({ error: "Explanation is required for every answer" })
    .min(1, "Explanation is required for every answer"),
});

const SeatActionSchema = z.object({
  action: z.enum(["Fold", "Check", "Limp", "Call", "Bet", "Raise", "3-bet", "4-bet", "All-in"], {
    error: () => "action must be one of: Fold, Check, Limp, Call, Bet, Raise, 3-bet, 4-bet, All-in",
  }),
  amount: z.number().nonnegative("amount must be zero or greater").optional(),
});

export const HandScenarioStateSchema = z.object({
  street: z.enum(["preflop", "flop", "turn", "river"], {
    error: () => "street must be one of: preflop, flop, turn, river",
  }),
  hero_position: z
    .string({ error: "hero_position is required" })
    .min(1, "hero_position is required"),
  hero_hole_cards: z.array(z.string()).optional(),
  board_cards: z.array(z.string()).optional(),
  pot_size: z
    .number()
    .nonnegative("pot_size must be zero or greater")
    .optional(),
  stack_sizes: z.record(z.string(), z.number()).optional(),
  villain_player_types: z.record(z.string(), z.string()).optional(),
  seat_actions: z.record(z.string(), SeatActionSchema).optional(),
  notes: z.string().optional(),
});

export const QuestionSchema = z
  .object({
    question_id: z
      .string({ error: "question_id is required" })
      .min(1, "question_id is required"),
    type: z.enum(["multiple_choice", "hand_scenario"], {
      error: () => "type must be either 'multiple_choice' or 'hand_scenario'",
    }),
    prompt: z
      .string({ error: "Question prompt is required" })
      .min(1, "Question prompt is required"),
    answers: z
      .array(AnswerSchema)
      .length(4, "Each question must have exactly 4 answers")
      .refine((arr) => arr.filter((a) => a.is_correct).length === 1, {
        message: "Exactly one answer must have is_correct=true",
      }),
    table_state: HandScenarioStateSchema.optional(),
    glossary_terms: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "hand_scenario" && data.table_state === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["table_state"],
        message: "table_state is required for hand_scenario questions",
      });
    }
  });

export const LessonSchema = z.object({
  // Optional: if the author omits it, the pipeline auto-generates a unique
  // slug from the title at save time. When provided it must be non-empty.
  lesson_id: z
    .string()
    .min(1, "lesson_id cannot be empty")
    .optional(),
  title: z
    .string({ error: "title is required" })
    .min(1, "title is required"),
  principle_tag: z
    .string({ error: "principle_tag is required" })
    .min(1, "principle_tag is required"),
  concept: z
    .string({ error: "concept is required" })
    .min(1, "concept is required"),
  difficulty: z
    .enum(["beginner", "intermediate", "advanced"], {
      error: () =>
        "difficulty must be one of: beginner, intermediate, advanced",
    })
    .optional(),
  questions: z
    .array(QuestionSchema)
    .min(1, "A lesson must contain at least one question"),
});

export type Answer = z.infer<typeof AnswerSchema>;
export type HandScenarioState = z.infer<typeof HandScenarioStateSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
