import type { SurveyQuestion } from "../../convex/members/demographics";
import type { ReviewInput } from "../../convex/members/reviews";

/** One explicit answer or skipped question awaiting persistence. */
export type SurveyWrite = { question: SurveyQuestion; values?: string[]; review?: ReviewInput };

/** Serialize writes and retain failed answers until an explicit retry. */
export class SurveyWrites {
    private pending = new Map<SurveyQuestion, SurveyWrite>();
    private running?: Promise<void>;

    constructor(private save: (answers: SurveyWrite[]) => Promise<unknown>) {}

    /** Report whether leaving would lose unpersisted answers. */
    get isPending() {
        return this.pending.size > 0;
    }

    /** Replace older pending values without allowing a skip to erase an answer. */
    add(answer: SurveyWrite) {
        if (answer.values !== undefined || !this.pending.has(answer.question))
            this.pending.set(answer.question, answer);
    }

    /** Drain in order; remove only the exact versions acknowledged by the server. */
    flush(): Promise<void> {
        if (!this.running)
            this.running = this.drain().finally(() => {
                this.running = undefined;
            });

        return this.running;
    }

    /** Coalesce changes made while a previous request is in flight. */
    private async drain() {
        while (this.pending.size) {
            const batch = [...this.pending.values()];
            await this.save(batch);
            for (const answer of batch) {
                if (this.pending.get(answer.question) === answer)
                    this.pending.delete(answer.question);
            }
        }
    }
}
