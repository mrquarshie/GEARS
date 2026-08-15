import { useEffect, useState } from 'react';

// Types each phrase out character-by-character, holds it, then deletes it
// before moving to the next — looping forever. Used for the specialty text
// on mechanic cards (same animation style as the search placeholder).
export function useTypewriterLoop(phrases, { holdMs = 7000, typeMs = 50, deleteMs = 25 } = {}) {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setPhraseIdx(0);
    setText('');
    setIsDeleting(false);
  }, [phrases]);

  useEffect(() => {
    const current = phrases[phraseIdx];
    if (!current) return;
    let timer;
    if (!isDeleting) {
      if (text.length < current.length) {
        timer = setTimeout(() => setText(current.slice(0, text.length + 1)), typeMs);
      } else {
        timer = setTimeout(() => setIsDeleting(true), holdMs);
      }
    } else {
      if (text.length > 0) {
        timer = setTimeout(() => setText(text.slice(0, -1)), deleteMs);
      } else {
        setIsDeleting(false);
        setPhraseIdx(prev => (prev + 1) % phrases.length);
      }
    }
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, isDeleting, phraseIdx]);

  return text;
}
