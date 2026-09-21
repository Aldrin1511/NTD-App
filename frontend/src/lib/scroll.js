/** Jump the window (and any documentElement/body fallback) to the top of the view. */
export function scrollViewToTop() {
  window.scrollTo(0, 0);
  if (document.documentElement) document.documentElement.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;
}
