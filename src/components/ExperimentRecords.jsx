import { useState } from 'react';
import { api } from '../api/client';
import { experimentCondition } from '../utils/experiment';
import { Btn } from './ui';

function summarize(events) {
  const visits = new Map();
  for (const event of events) {
    const visitId = event.details?.visit_id;
    if (!visitId || !['stage_start', 'stage_end'].includes(event.event_type)) continue;
    const visit = visits.get(visitId) || {};
    visit[event.event_type] = event.occurred_at;
    visits.set(visitId, visit);
  }
  const incompleteVisits = [...visits.values()].filter(visit =>
    !visit.stage_start || !visit.stage_end || Date.parse(visit.stage_end) < Date.parse(visit.stage_start)
  ).length;
  return {
    total: events.length,
    model: events.filter(event => event.condition === 'model').length,
    fixed: events.filter(event => event.condition === 'fixed').length,
    incompleteVisits,
  };
}

export function ExperimentRecords({ project }) {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const condition = experimentCondition(project);
  const projectId = project?.projectId || project?.id;
  if (!condition || !projectId) return null;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setEvents(await api.projects.getInteractionEvents(projectId));
    } catch {
      setEvents(null);
      setError('读取实验记录失败。请检查连接、项目权限或数据库迁移。');
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    const data = {
      schema_version: 1,
      project_id: projectId,
      current_condition: condition,
      exported_at: new Date().toISOString(),
      events,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `experiment-${projectId}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const summary = events && summarize(events);
  return (
    <section aria-label="实验过程记录" style={{ marginTop: 16 }}>
      <h3 style={{ marginBottom: 8 }}>实验过程记录</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn small variant="ghost" disabled={loading} onClick={load}>{loading ? '读取中…' : '检查记录'}</Btn>
        <Btn small disabled={loading || !summary?.total} onClick={download}>导出记录 JSON</Btn>
      </div>
      {error && <p role="alert">{error}</p>}
      {summary && (
        <div aria-live="polite">
          <p>{summary.total} 条记录 · 模型组 {summary.model} · 对照组 {summary.fixed}</p>
          {summary.model > 0 && summary.fixed > 0 && <p>此项目存在两种配置下的记录，分析时请按事件所属配置核对。</p>}
          {summary.incompleteVisits > 0 && <p>{summary.incompleteVisits} 次访问缺少完整的阶段起止时间，统计用时前请核对。</p>}
          {summary.total === 0 && <p>此项目暂未读到过程事件。</p>}
        </div>
      )}
    </section>
  );
}
