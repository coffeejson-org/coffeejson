// Gives every code block on the page a Copy button. The page is complete
// without it: the blocks are text, and a reader can select them.

for (const pre of document.querySelectorAll<HTMLPreElement>("main pre")) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy";
  button.textContent = "Copy";
  button.addEventListener("click", async () => {
    if (button.getAttribute("aria-busy") === "true") return;
    button.setAttribute("aria-busy", "true");
    try {
      await navigator.clipboard.writeText(
        pre.querySelector("code")?.textContent ?? "",
      );
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = "Copy";
      }, 1200);
    } finally {
      button.removeAttribute("aria-busy");
    }
  });
  const frame = document.createElement("div");
  frame.className = "copyable";
  pre.replaceWith(frame);
  frame.append(pre, button);
}
