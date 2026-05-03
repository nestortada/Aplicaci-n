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

  await clipboard.writeText(text);
}
