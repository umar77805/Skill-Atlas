import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { skillsOptions } from '../queries.ts';
import { LoadingBlock, ErrorBlock } from './StateBlock.tsx';
import type { SkillSummary } from '../types.ts';

export interface SimulatedProfile {
  name: string;
  skills: string[];
}

interface AddYourselfModalProps {
  existingProfile: SimulatedProfile | null;
  onClose: () => void;
  onSave: (profile: SimulatedProfile) => void;
  onRemove: () => void;
}

export default function AddYourselfModal({ existingProfile, onClose, onSave, onRemove }: AddYourselfModalProps) {
  const [name, setName] = useState(existingProfile?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(existingProfile?.skills ?? []));

  const { data: allSkills, isError, error, refetch } = useQuery(skillsOptions);
  const loadError = isError ? (error as Error).message : null;

  const grouped = useMemo(() => {
    const map = new Map<string, SkillSummary[]>();
    for (const s of allSkills ?? []) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return map;
  }, [allSkills]);

  const toggleSkill = (skillName: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(skillName) ? next.delete(skillName) : next.add(skillName);
      return next;
    });
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Enter a name so we know what to call your profile.');
      return;
    }
    onSave({ name: trimmed, skills: Array.from(selected) });
  };

  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="add-yourself-title">
        <h2 className="modal-title" id="add-yourself-title">Add yourself</h2>
        <p className="modal-body">
          Enter your name and pick the skills you already have. This runs the same skill-gap and learning-path
          queries used for the demo learners, but nothing here is saved to the database — it only lives for this
          browser session and disappears on reload.
        </p>

        <div className="field" style={{ marginBottom: 18 }}>
          <label htmlFor="simulated-name">Your name</label>
          <input
            id="simulated-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(null); }}
            placeholder="e.g. Jordan Lee"
          />
        </div>
        {nameError && <div className="field-error">{nameError}</div>}

        {loadError && <ErrorBlock message={loadError} onRetry={() => refetch()} />}
        {!loadError && !allSkills && <LoadingBlock label="Loading skills…" />}
        {allSkills && (
          <div className="skill-picker-scroll">
            {Array.from(grouped.entries()).map(([category, skillsInCategory]) => (
              <div className="skill-picker-group" key={category}>
                <div className="skill-picker-group-label">{category}</div>
                <div className="filter-toggles">
                  {skillsInCategory.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      className={`toggle-chip${selected.has(s.name) ? ' on' : ''}`}
                      onClick={() => toggleSkill(s.name)}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={`modal-actions${existingProfile ? ' split' : ''}`}>
          {existingProfile && (
            <button type="button" className="modal-cta-ghost" onClick={onRemove}>Remove profile</button>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="modal-cta-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="modal-cta" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
