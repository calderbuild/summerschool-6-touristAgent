/**
 * Turn a streamed answer into something worth hearing.
 *
 * The answers are markdown, and the assistant is told to cite an official link
 * for every price and opening time. Spoken back verbatim that becomes
 * "bracket Official site bracket paren h t t p s colon slash slash w w w dot
 * service dash public dot gouv dot f r slash particuliers slash vosdroits
 * slash F 3 3 9 5 4 question mark lang equals e n". The people most likely to
 * press read-aloud are the ones who cannot read the screen, so the same care
 * the visual rendering gets is owed to the audio: keep the link's words, drop
 * its address, and let the emphasis markers go silent.
 *
 * Used for both read-aloud and the screen-reader live region, because a screen
 * reader is fed exactly the same string.
 */
export function speakable(text: string): string {
  return (
    text
      // App-internal route markers are never spoken.
      .replace(/\[\[[^\]]*\]\]/g, "")
      // A link becomes its label. The address stays on screen for anyone who
      // wants to tap it.
      .replace(/\[([^\]\n]+)\]\((?:https?:\/\/[^\s)]+)\)/g, "$1")
      // A bare URL is unspeakable, and the sentence around it still makes sense.
      .replace(/<?https?:\/\/[^\s>)]+>?/g, "")
      .replace(/`([^`\n]+)`/g, "$1")
      // Same single-line shapes the visual renderer matches, so what is heard and
      // what is shown are derived from the same reading of the markdown.
      .replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g, (_m, a, b) => a ?? b)
      .replace(/\*([^*\n]+)\*|_([^_\n]+)_/g, (_m, a, b) => a ?? b)
      // A heading's hashes and a list's dashes are layout, not words. The line
      // break that follows is what creates the pause, so nothing replaces them.
      // Indentation is matched as spaces and tabs, never \s, which would also eat
      // the blank line before a list and run two paragraphs together in speech.
      .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
      .replace(/^[ \t]*[-*][ \t]+/gm, "")
      .replace(/^[ \t]*\d+[.)][ \t]+/gm, "")
      // Rules and table pipes read as noise.
      .replace(/^\s*([-*_]\s*){3,}$/gm, "")
      .replace(/[ \t]*\|[ \t]*/g, ", ")
      // Removing an address can leave the punctuation that introduced it hanging:
      // "check the accessibility page before you travel:" with nothing after the
      // colon, or an empty pair of brackets. Close the sentence instead.
      .replace(/\(\s*\)|\[\s*\]/g, "")
      .replace(/[ \t]*:[ \t]*(?=\n|$)/g, ".")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
