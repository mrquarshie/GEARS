import { useEffect, useState } from 'react';

// Types out each phrase then deletes it before moving to the next — the
// animated placeholder shown in search inputs across the app. `phrases`
// should be a stable reference per category (see searchPlaceholders.js) so
// the reset effect only fires when the category actually changes.
export function useTypewriterPlaceholder(phrases) {
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
    let timer;
    if (!isDeleting) {
      if (text.length < current.length) {
        timer = setTimeout(() => setText(current.slice(0, text.length + 1)), 50);
      } else {
        timer = setTimeout(() => setIsDeleting(true), 3000);
      }
    } else {
      if (text.length > 0) {
        timer = setTimeout(() => setText(text.slice(0, -1)), 25);
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
