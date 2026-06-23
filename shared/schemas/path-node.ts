import { z } from "zod";

// One node in the Skills Path (the Duolingo-style guided map, built in M4). A
// node groups one or more lessons into a single step on the map and declares the
// nodes that must be completed before it unlocks.
//
// prerequisites are node_ids, not lesson_ids: the map's edges connect nodes to
// nodes. Cycle detection and the "is this unlocked yet" logic live in the app,
// not the schema. The schema only guarantees the shape is well-formed.
export const PathNodeSchema = z.object({
  node_id: z
    .string({ error: "node_id is required" })
    .min(1, "node_id is required"),
  title: z
    .string({ error: "title is required" })
    .min(1, "title is required"),
  // The lessons a member works through to complete this node. At least one,
  // otherwise the node has nothing behind it.
  lesson_ids: z
    .array(z.string())
    .min(1, "a path node must reference at least one lesson"),
  // node_ids that must be completed before this one unlocks. Omitted/empty means
  // it's available from the start.
  prerequisites: z.array(z.string()).optional(),
});

export type PathNode = z.infer<typeof PathNodeSchema>;
