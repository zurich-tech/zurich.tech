import { authComponent } from "./component";

/** Synchronize member records after provider identity changes. */
export const { onCreate, onDelete, onUpdate } = authComponent.triggersApi();

/** Read the authenticated provider identity. */
export const { getAuthUser } = authComponent.clientApi();
