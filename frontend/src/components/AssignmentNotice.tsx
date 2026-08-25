import { useState } from 'react';

const STORAGE_KEY = 'skillatlas.introSeen';

export default function AssignmentNotice() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

  if (dismissed) return null;

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  }

  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="assignment-notice-title">
        <h2 className="modal-title" id="assignment-notice-title">Before you dive in</h2>
        <p className="modal-body">
          Skill Atlas is a demo built for an interview assignment from Wexa AI — not a production app.
          Feel free to explore every page and poke around; nothing here is real user data.
        </p>
        <div className="modal-actions">
          <button type="button" className="modal-cta" onClick={handleDismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
