import { useState } from 'react';
import { api } from '../api/client';
import { getExhibitName } from '../utils/exhibitFields';
import { assessExhibitEvidence } from '../utils/exhibitEvidence';
import { ExhibitJudgments } from './ExhibitJudgments';
import { Btn } from './ui';

export function ExhibitWriting({ section, exhibits, condition, sharedRules, save, log, C }) {
  const [sample, setSample] = useState(null);
  const [ruleDraft, setRuleDraft] = useState([]);
  const [handoff, setHandoff] = useState(null);
  const [ruleScope, setRuleScope] = useState('unit');
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState([]);
  const [instruction, setInstruction] = useState('');
  const [heldKeys, setHeldKeys] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmingRule, setConfirmingRule] = useState(false);
  const rule = section.exhibitWritingRule || sharedRules.content_type || sharedRules.project;
  const scopeLabels = { unit: '本单元', content_type: '本项目的展品说明', project: '项目' };
  const fixed = condition === 'fixed';
  const records = exhibits.map((exhibit, index) => ({ ...exhibit, name: getExhibitName(exhibit), entryKey: String(exhibit.id || exhibit.编号 || `index-${index}`) }));
  const mode = fixed || rule ? 'guided_generation' : 'interactive_editing';
  const scope = { section_key: section.key, content_type: 'exhibit_description' };
  const sourceChoices = section.exhibitSourceChoices || {};
  const evidence = new Map(records.map(record => [
    record.entryKey, assessExhibitEvidence(record, fixed ? {} : sourceChoices[record.entryKey]),
  ]));
  const observedConflicts = records.filter(record => evidence.get(record.entryKey).detected.length > 0);
  const conflicting = records.filter(record => evidence.get(record.entryKey).state === 'conflict');
  const available = records.filter(record => {
    const state = evidence.get(record.entryKey).state;
    return record.name && (state === 'available' || state === 'unlocated');
  });
  const missing = records.filter(record => !available.includes(record) && !conflicting.includes(record));
  const eligible = available.filter(record => !heldKeys.includes(record.entryKey) && (
    (instruction.trim() && (fixed || rule)) || !(section.exhibits || []).some(item =>
      item.curatorReviewed && (item.entryKey ? item.entryKey === record.entryKey : item.name === record.name)
    )
  ));

  const changeJudgment = (entryKey, hold) => {
    setHeldKeys(keys => hold ? [...keys, entryKey] : keys.filter(key => key !== entryKey));
    log('clarification', { scope, kind: 'judgment_override', entry_key: entryKey, state: hold ? 'needs_review' : 'available' });
  };

  const chooseSource = async (entryKey, field, sourceId) => {
    setBusy(true);
    try {
      const saved = await save(section, {
        exhibitSourceChoices: {
          ...sourceChoices, [entryKey]: { ...sourceChoices[entryKey], [field]: sourceId || null },
        },
      });
      if (saved) log('clarification', {
        scope, kind: 'source_selection', timing: 'handoff', entry_key: entryKey,
        field, source_id: sourceId || null,
      });
    } finally {
      setBusy(false);
    }
  };

  const run = async (action, operation) => {
    setBusy(true);
    setError('');
    log('request_start', {
      task: 'exhibit_description', scope, action, mode,
      ...(fixed ? {} : { state: { writing_rule_confirmed: Boolean(rule), available: available.length, missing: missing.length, conflicting: conflicting.length, held_keys: heldKeys } }),
    });
    try {
      await operation();
      log('generation_result', { scope, action, outcome: 'ready' });
    } catch (error) {
      setError(error.message || '处理失败，请重试。');
      log('generation_result', { scope, action, outcome: 'failed' });
    } finally {
      setBusy(false);
    }
  };

  const generate = async kind => {
    const capturedSample = section.exhibitWritingSample || section.exhibitWritingRule?.sample;
    const savedSample = !fixed && capturedSample && eligible.some(item => item.entryKey === capturedSample.key)
      ? capturedSample : null;
    const target = kind === 'sample' ? eligible.slice(0, 1) : eligible.filter(item => item.entryKey !== savedSample?.key);
    await run(kind, async () => {
      const items = target.length ? await api.ai.writeExhibitDescriptions({
        action: 'draft', exhibits: target.map(record => {
          const { sources } = evidence.get(record.entryKey);
          return sources.length ? { entryKey: record.entryKey, name: record.name, source_records: sources } : record;
        }), instruction: [fixed ? '' : rule?.text, instruction.trim()].filter(Boolean).join('\n'),
      }) : [];
      if (items.length !== target.length || target.some(record => !items.some(item => item.key === record.entryKey && item.text?.trim()))) {
        throw new Error('返回的条目与所选展品不一致，请重新生成。');
      }
      if (!fixed) setHandoff({
        drafted: items.length,
        suspended: conflicting.length + heldKeys.length,
        missing: missing.length,
        next: kind === 'sample' ? '请修改试写样稿，再归纳写法。' : '请预览本次生成的说明，并选择要应用的条目。',
      });
      if (kind === 'sample') {
        setSample({ ...items[0], original: items[0].text });
      } else if (fixed) {
        const current = section.exhibits || [];
        const protectedItems = items.filter(item => current.some(entry => matchesRecord(entry, item.key) && entry.curatorReviewed));
        const drafts = items.filter(item => !protectedItems.includes(item));
        if (drafts.length && !await save(section, mergeExhibits(drafts, false))) {
          throw new Error('展品说明未能写入大纲，请重试。');
        }
        setCandidates(protectedItems);
        setSelected(protectedItems.map(item => item.key));
      } else {
        const preview = savedSample ? [savedSample, ...items] : items;
        setCandidates(preview);
        setSelected(preview.map(item => item.key));
      }
    });
  };

  const infer = () => run('infer_rule', async () => {
    const result = await api.ai.writeExhibitDescriptions({
      action: 'infer_rule', original: sample.original, edited: sample.text,
    });
    const rows = typeof result === 'string' ? [{ text: result, reusable: true }] : result?.rules;
    if (!rows?.some(row => row.text?.trim())) throw new Error('未归纳出可确认的写法。');
    setRuleDraft(rows.filter(row => row.text?.trim()).map(row => ({ ...row, selected: row.reusable === true })));
    setConfirmingRule(true);
  });

  const confirmRule = async () => {
    const chosenRules = ruleDraft.filter(row => row.selected && row.text.trim()).map(row => row.text.trim());
    const text = chosenRules.join('\n');
    if (!text) return;
    setBusy(true);
    try {
      const confirmed = { text, items: chosenRules, scope: ruleScope, source: 'confirmed_sample' };
      const changes = { exhibitWritingSample: {
        key: sample.key, text: sample.text,
        judgments: sample.text === sample.original ? sample.judgments : undefined,
      } };
      if (ruleScope === 'unit') changes.exhibitWritingRule = confirmed;
      const nextSharedRules = ruleScope === 'unit' ? undefined : { ...sharedRules, [ruleScope]: confirmed };
      if (!await save(section, changes, nextSharedRules)) return;
      log('revision', { scope, method: 'confirm_writing_rule', requirement_scope: ruleScope, selected_count: chosenRules.length, proposed_count: ruleDraft.length });
      if (!rule) log('mode_change', { scope, from: mode, to: 'guided_generation', reason: 'writing_rule_confirmed' });
      setConfirmingRule(false);
    } finally {
      setBusy(false);
    }
  };

  const matchesRecord = (entry, key) => entry.entryKey
    ? entry.entryKey === key : entry.name === records.find(record => record.entryKey === key)?.name;

  const mergeExhibits = (items, reviewed) => ({
    exhibits: [
      ...(section.exhibits || []).filter(entry => !items.some(item => matchesRecord(entry, item.key))),
      ...items.map(item => ({
        entryKey: item.key, name: records.find(record => record.entryKey === item.key)?.name,
        desc: item.text, judgments: item.judgments, curatorReviewed: reviewed, reviewStatus: reviewed ? 'confirmed' : 'pending',
        sourceRecords: evidence.get(item.key).sources.map(({ id, label, locator }) => ({ id, label, locator })),
      })),
    ],
  });

  const confirmDescription = async (item) => {
    setBusy(true);
    try {
      const saved = await save(section, {
        exhibits: section.exhibits.map(entry => entry === item
          ? { ...entry, curatorReviewed: true, reviewStatus: 'confirmed' } : entry),
      });
      if (saved) log('candidate_disposition', { scope, outcome: 'accepted', selected_keys: [item.entryKey] });
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    const accepted = candidates.filter(item => selected.includes(item.key));
    setBusy(true);
    try {
      if (!await save(section, mergeExhibits(accepted, true))) return;
      log('candidate_disposition', { scope, outcome: 'accepted', selected_keys: selected,
        discarded_keys: candidates.filter(item => !selected.includes(item.key)).map(item => item.key) });
      setCandidates([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 16, border: `1px solid ${C.border}`, marginTop: 12, display: 'grid', gap: 10 }}>
      <strong>展品说明</strong>
      {!fixed && <>
        <span>{rule ? '本单元写法已确认，下一次按写法引导生成。' : '写法待确认，先试写一条供策展人修改。'}</span>
        <details>
          <summary>本次判断 · {available.length - heldKeys.length} 件可起草，{missing.length} 件缺项，{conflicting.length} 件冲突</summary>
          {available.map(record => <label key={record.entryKey} style={{ display: 'block' }}>
            <input type="checkbox" checked={heldKeys.includes(record.entryKey)} disabled={busy || candidates.length > 0}
              onChange={event => changeJudgment(record.entryKey, event.target.checked)} /> {record.name} 暂缓起草
          </label>)}
        </details>
        {rule && <span>当前生效写法（{scopeLabels[rule.scope] || '本单元'}）：{rule.text}</span>}
      </>}
      <span>本次由人工智能起草，策展人审阅确认。作用范围为本单元的展品说明。</span>
      {!fixed && handoff && <section aria-label="本次工作交还">
        <strong>本次工作交还</strong>
        <div>已起草 {handoff.drafted} 件，暂缓 {handoff.suspended} 件，缺项 {handoff.missing} 件。</div>
        <div>{handoff.next}</div>
        {rule && <div>本次沿用写法：{rule.text}</div>}
      </section>}
      {observedConflicts.length > 0 && <section aria-label="资料冲突">
        <strong>资料冲突 · {conflicting.length} 件待核对</strong>
        {observedConflicts.map(record => <div key={record.entryKey}>
          <strong>{record.name}</strong>
          {evidence.get(record.entryKey).detected.map(conflict => <div key={conflict.key}>
            {conflict.label}记载不一致
            <ul>{conflict.entries.map(entry => <li key={entry.sourceId}>{entry.value}（{entry.label} · {entry.locator}）</li>)}</ul>
            {!fixed && <label>采用的{conflict.label}来源{' '}
              <select value={sourceChoices[record.entryKey]?.[conflict.key] || ''}
                disabled={busy || candidates.length > 0} onChange={event => chooseSource(record.entryKey, conflict.key, event.target.value)}>
                <option value="">暂缓该条目</option>
                {conflict.entries.map(entry => <option key={entry.sourceId} value={entry.sourceId}>{entry.label} · {entry.locator}</option>)}
              </select>
            </label>}
          </div>)}
        </div>)}
      </section>}
      {missing.length > 0 && <span>缺少说明资料，暂留空：{missing.map(item => item.name || '未命名展品').join('、')}</span>}
      {(section.exhibits || []).filter(item => item.curatorReviewed || item.reviewStatus === 'pending').map(item => (
        <div key={item.entryKey}>
          <strong>{item.name}</strong>　{item.desc}
          <ExhibitJudgments judgments={item.judgments} />
          {item.reviewStatus === 'pending' && <>
            {' '}<span>待审阅</span>{' '}
            <Btn small disabled={busy} onClick={() => confirmDescription(item)}>确认{item.name}说明</Btn>
          </>}
        </div>
      ))}
      <label>本次修改意见 <input value={instruction} disabled={busy} onChange={event => setInstruction(event.target.value)} /></label>
      <div>
        <Btn small disabled={busy || eligible.length === 0 || candidates.length > 0}
          onClick={() => generate(fixed || rule ? 'batch' : 'sample')}>
          {busy ? '处理中…' : fixed || rule ? '生成展品说明' : '生成试写样稿'}
        </Btn>
      </div>
      {sample && !fixed && !rule && <>
        <label>试写样稿
          <textarea style={{ display: 'block', width: '100%' }} rows={4} value={sample.text} disabled={busy}
            onChange={event => { setSample({ ...sample, text: event.target.value }); setConfirmingRule(false); }} />
        </label>
        <ExhibitJudgments judgments={sample.text === sample.original ? sample.judgments : undefined} />
        <Btn small disabled={busy || !sample.text.trim()} onClick={infer}>归纳写法</Btn>
      </>}
      {confirmingRule && <>
        <fieldset disabled={busy}>
          <legend>逐项选择拟沿用的写法</legend>
          {ruleDraft.map((row, index) => <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <label><input type="checkbox" checked={row.selected}
              onChange={event => setRuleDraft(items => items.map((item, i) => i === index
                ? { ...item, selected: event.target.checked } : item))} /> 沿用第 {index + 1} 项</label>
            <input aria-label={`写法第 ${index + 1} 项`} style={{ flex: 1 }} value={row.text}
              onChange={event => setRuleDraft(items => items.map((item, i) => i === index
                ? { ...item, text: event.target.value } : item))} />
          </div>)}
        </fieldset>
        <label>沿用范围{' '}
          <select value={ruleScope} disabled={busy} onChange={event => setRuleScope(event.target.value)}>
            {Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <Btn small disabled={busy || !ruleDraft.some(row => row.selected && row.text.trim())} onClick={confirmRule}>确认写法</Btn>
      </>}
      {candidates.length > 0 && <>
        <strong>{fixed ? '已确认文字的修改建议' : '逐条预览'}</strong>
        {candidates.map(item => {
          const record = records.find(entry => entry.entryKey === item.key);
          const before = (section.exhibits || []).find(entry => entry.name === record.name)?.desc;
          return <div key={item.key} style={{ display: 'grid', gap: 4 }}>
            <label><input type="checkbox" checked={selected.includes(item.key)} disabled={busy}
              onChange={event => setSelected(event.target.checked ? [...selected, item.key] : selected.filter(key => key !== item.key))} /> {record.name}</label>
            {before && <span>原文 {before}</span>}
            <span>候选 {item.text}</span>
            <ExhibitJudgments judgments={item.judgments} />
            {evidence.get(item.key).state === 'unlocated'
              ? <span>导入资料尚无可定位出处，待核实</span>
              : <span>本次提供的资料：{evidence.get(item.key).sources.map(source => `${source.label} · ${source.locator}`).join('；')}</span>}
          </div>;
        })}
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn small disabled={busy || !selected.length} onClick={apply}>应用所选条目</Btn>
          <Btn small variant="ghost" disabled={busy} onClick={() => {
            log('candidate_disposition', { scope, outcome: 'discarded', discarded_keys: candidates.map(item => item.key) });
            setCandidates([]);
          }}>弃用候选</Btn>
        </div>
      </>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
