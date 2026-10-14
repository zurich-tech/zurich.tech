import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";

/** Approved subjects and their stable parent keys. */
export const catalogue: readonly Pick<Doc<"topics">, "slug" | "name" | "parent">[] = [
    { slug: "ai", name: "AI" },
    { slug: "machine-learning", name: "ML", parent: "ai" },
    { slug: "nlp", name: "NLP", parent: "ai" },
    { slug: "computer-vision", name: "CV", parent: "ai" },
    { slug: "reinforcement-learning", name: "RL", parent: "ai" },
    { slug: "agents", name: "Agents", parent: "ai" },
    { slug: "software-engineering", name: "Software" },
    { slug: "distributed-systems", name: "Systems", parent: "software-engineering" },
    { slug: "cloud", name: "Cloud", parent: "software-engineering" },
    { slug: "data-engineering", name: "Data" },
    { slug: "databases", name: "Databases", parent: "data-engineering" },
    { slug: "analytics", name: "Analytics", parent: "data-engineering" },
    { slug: "security", name: "Security" },
    { slug: "cryptography", name: "Cryptography", parent: "security" },
    { slug: "hardware", name: "Hardware" },
    { slug: "electronics", name: "Electronics", parent: "hardware" },
    { slug: "semiconductors", name: "Semiconductors", parent: "hardware" },
    { slug: "embedded", name: "Embedded", parent: "hardware" },
    { slug: "robotics", name: "Robotics" },
    { slug: "quantum", name: "Quantum" },
    { slug: "photonics", name: "Photonics" },
    { slug: "biotech", name: "Biotech" },
    { slug: "medtech", name: "Medtech" },
    { slug: "climate-tech", name: "Energy" },
    { slug: "materials", name: "Materials" },
    { slug: "manufacturing", name: "Manufacturing" },
    { slug: "fintech", name: "Fintech" },
    { slug: "space", name: "Space" },
    { slug: "telecom", name: "Telecom" },
    { slug: "graphics", name: "Graphics" },
    { slug: "product-design", name: "Design" },
    { slug: "ai-policy", name: "Policy" },
    { slug: "startups", name: "Startups" },
];

/** Reject duplicate keys, ambiguous active labels, unknown parents and cycles. */
export function validateHierarchy(
    topics: readonly Pick<Doc<"topics">, "slug" | "name" | "parent" | "isActive">[],
) {
    // index stable keys and ensure each active label names one subject
    const keys = new Map(topics.map((topic) => [topic.slug, topic]));
    if (keys.size !== topics.length) throw new ConvexError("Topic keys must be unique.");
    const names = new Set<string>();
    for (const topic of topics) {
        if (topic.isActive) {
            const name = topic.name.toLowerCase();
            if (names.has(name)) throw new ConvexError("A topic already uses this name.");
            names.add(name);
        }

        // walk each ancestry so no reparenting can leave a cycle or orphan
        const visited = new Set([topic.slug]);
        let parent = topic.parent;
        while (parent !== undefined) {
            if (visited.has(parent))
                throw new ConvexError(`Topic hierarchy contains a cycle: ${parent}.`);
            const ancestor = keys.get(parent);
            if (!ancestor) throw new ConvexError(`Unknown parent topic: ${parent}.`);
            if (topic.isActive && !ancestor.isActive)
                throw new ConvexError(`Active topics require active parents: ${topic.slug}.`);
            visited.add(parent);
            parent = ancestor.parent;
        }
    }
}
