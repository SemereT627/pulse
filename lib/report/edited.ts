const EDITED = " · edited";
const BY_HAND = "Written by you";

/** The `narrativeModel` label after a hand edit: "<model> · edited", or "Written by you" with no model. */
export function editedModel(model: string | null) {
  if (!model) return BY_HAND;
  return isEdited(model) ? model : model + EDITED;
}

/** Whether a summary has hand edits a rewrite would throw away. */
export const isEdited = (model: string | null) => !!model && (model.endsWith(EDITED) || model === BY_HAND);
