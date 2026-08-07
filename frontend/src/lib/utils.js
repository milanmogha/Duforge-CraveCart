import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Bridge Radix-style `asChild` onto Base UI's `render` prop. When `asChild` is
// set, the single child element becomes the element Base UI renders into
// (merging handlers/aria/ref onto it) instead of nesting a second DOM node.
// Returns the props to spread onto the Base UI primitive.
export function asChildRender({ asChild, render, children }) {
  return asChild ? { render: children } : { render, children };
}
