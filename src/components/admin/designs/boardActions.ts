/** The server actions a design chooser calls: a founder's, or a designer's, which check the business is theirs. */
export type BoardActions = {
  choose: (formData: FormData) => Promise<void>;
  revise: (formData: FormData) => Promise<void>;
  redraw: (formData: FormData) => Promise<void>;
};
