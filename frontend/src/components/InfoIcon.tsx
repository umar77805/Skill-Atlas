import { useEffect, useRef, useState } from 'react';

interface InfoIconProps {
  tooltip: string;
  ariaLabel: string;
}

// Purely informational "i" icon. Tooltip shows on hover/focus for mouse and
// keyboard users (CSS-only, unchanged); on touch, hover never fires, so a tap
// toggles it open instead, closing on an outside tap or Escape.
export default function InfoIcon({ tooltip, ariaLabel }: InfoIconProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      className={`info-icon${open ? ' open' : ''}`}
      tabIndex={0}
      role="img"
      aria-label={ariaLabel}
      data-tooltip={tooltip}
      onClick={() => setOpen((o) => !o)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); } }}
    >
      i
    </span>
  );
}
