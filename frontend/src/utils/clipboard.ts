interface ClipboardPayload {
  text: string;
  html?: string;
}

export async function copyRichText({ text, html }: ClipboardPayload): Promise<void> {
  const clipboard = navigator.clipboard;
  if (!clipboard) {
    throw new Error("El portapapeles no está disponible en este navegador.");
  }

  if (html && "ClipboardItem" in window && typeof clipboard.write === "function") {
    try {
      await clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return;
    } catch {
      // Some browsers expose ClipboardItem but only allow plain text outside HTTPS.
    }
  }

  if (html && copyHtmlWithSelectionFallback(html)) {
    return;
  }

  await clipboard.writeText(text);
}

function copyHtmlWithSelectionFallback(html: string): boolean {
  const selection = window.getSelection();
  if (!selection) {
    return false;
  }

  const container = document.createElement("div");
  container.contentEditable = "true";
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.innerHTML = html;
  document.body.appendChild(container);

  const range = document.createRange();
  range.selectNodeContents(container);
  selection.removeAllRanges();
  selection.addRange(range);

  try {
    return document.execCommand("copy");
  } finally {
    selection.removeAllRanges();
    container.remove();
  }
}
