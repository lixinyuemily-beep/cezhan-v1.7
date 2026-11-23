import { useState } from 'react';
import { Btn } from './ui';

const displayLocations = units => units.map(unit => unit.title).join('、') || '未在大纲展出';

export function ExhibitReferences({ references, choices, changes, disabled, onAdd, onReview }) {
  const [selectedKey, setSelectedKey] = useState('');
  const changedKeys = new Set(changes.map(change => change.reference.key));
  const registeredKeys = new Set(references.map(reference => reference.key));
  const availableChoices = choices.filter(choice => !registeredKeys.has(choice.key));
  const selected = availableChoices.find(choice => choice.key === selectedKey);

  if (!references.length && !availableChoices.length) return null;

  return (
    <details open={changes.length > 0 || undefined} style={{ marginTop: 12 }}>
      <summary>跨单元展品引用{changes.length ? ` · ${changes.length} 项待复核` : ''}</summary>
      {changes.length > 0 && (
        <section aria-label="跨单元引用影响">
          {changes.map(({ reference, previous, units }) => (
            <div key={reference.key} style={{ marginTop: 10 }}>
              <strong>{reference.name || reference.key}</strong>
              <p>原位置 {displayLocations(previous)} → 现位置 {displayLocations(units)}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn small variant="ghost" disabled={disabled} onClick={() => onReview(reference, true)}>保留引用</Btn>
                <Btn small variant="ghost" disabled={disabled} onClick={() => onReview(reference, false)}>解除引用</Btn>
              </div>
            </div>
          ))}
          <p>处理引用后请核对正文。系统保留原有文字。</p>
        </section>
      )}
      {references.filter(reference => !changedKeys.has(reference.key)).map(reference => (
        <div key={reference.key} style={{ marginTop: 8 }}>
          {reference.name || reference.key} · {displayLocations(reference.units || [])}{' '}
          <Btn small variant="ghost" disabled={disabled} onClick={() => onReview(reference, false)}>解除引用</Btn>
        </div>
      ))}
      {availableChoices.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        <label>引用展品{' '}
          <select value={selected ? selectedKey : ''} disabled={disabled} onChange={event => setSelectedKey(event.target.value)}>
            <option value="">选择其他单元的展品</option>
            {availableChoices.map(choice => (
              <option key={choice.key} value={choice.key}>{choice.name || choice.key} · {displayLocations(choice.units)}</option>
            ))}
          </select>
        </label>
        <Btn small disabled={disabled || !selected} onClick={async () => {
          if (selected && await onAdd(selected)) setSelectedKey('');
        }}>登记引用</Btn>
      </div>}
    </details>
  );
}
