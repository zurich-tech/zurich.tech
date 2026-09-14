/** Track authored changes separately from values refreshed after a successful save. */
export class Edits {
    private baseline: string | undefined;
    private submitted: { value: string; revision: number } | undefined;
    private revision = 0;
    private hasInteracted = false;

    /** Capture loaded defaults before the first interaction, including after a save. */
    interact(read: () => string) {
        if (!this.hasInteracted) this.baseline = read();
        this.hasInteracted = true;
        this.revision++;
    }

    /** Compare authored values with the last accepted version. */
    isDirty(value: string) {
        return this.hasInteracted && this.baseline !== undefined && value !== this.baseline;
    }

    /** Remember exactly which version is being submitted. */
    submit(value: string) {
        this.submitted = { value, revision: this.revision };
    }

    /** Accept a successful save without accepting subsequent edits made during the request. */
    saved(value: string) {
        const submitted = this.submitted;
        const hasNewEdits =
            submitted !== undefined &&
            this.revision !== submitted.revision &&
            value !== submitted.value;
        this.baseline = hasNewEdits ? submitted.value : value;
        this.hasInteracted = hasNewEdits;
        this.submitted = undefined;
    }

    /** Accept a newly loaded record without treating it as an edit. */
    reset(value: string) {
        this.baseline = value;
        this.submitted = undefined;
        this.hasInteracted = false;
    }
}
