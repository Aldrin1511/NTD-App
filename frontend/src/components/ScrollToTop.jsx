import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { scrollViewToTop } from "@/lib/scroll";

/** Reset scroll whenever the route (page or query) changes so every entry view starts at the top. */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();
  useLayoutEffect(() => {
    scrollViewToTop();
  }, [pathname, search]);
  return null;
}
