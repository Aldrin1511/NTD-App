/** Input types where select-all-on-focus is useful. */
const SELECTABLE = new Set(["text", "number", "search", "tel", "url", "email", "password"]);

export const isSelectableInputType = (type) => {
  if (type == null || type === "") return true;
  return SELECTABLE.has(String(type).toLowerCase());
};

/**
 * First focus: select all text.
 * Second click (already focused): browser places the caret at the click.
 *
 * Selecting is deferred to the next frame so the focusing click's mouseup
 * does not immediately collapse the selection.
 */
export const withSelectAllOnFocus = ({ type, onFocus, ...rest } = {}) => {
  if (!isSelectableInputType(type)) {
    return { type, onFocus, ...rest };
  }
  return {
    type,
    ...rest,
    onFocus: (e) => {
      const el = e.currentTarget;
      requestAnimationFrame(() => {
        try {
          el.select();
        } catch {
          /* type=number on some browsers */
        }
      });
      onFocus?.(e);
    },
  };
};
