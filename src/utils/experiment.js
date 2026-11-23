import { api } from '../api/client';

export const newInteractionId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const experimentCondition = project => {
  const condition = project?.llmParams?.experiment_condition;
  return condition === 'model' || condition === 'fixed' ? condition : null;
};

export async function recordInteraction(project, stage, eventType, details = {}, keepalive = false) {
  const condition = experimentCondition(project);
  if (!condition || !project.id) return;
  const event = {
    event_id: newInteractionId(),
    condition,
    stage,
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    details,
  };
  try {
    await api.projects.addInteractionEvent(project.id, event, keepalive);
  } catch (firstError) {
    try {
      await api.projects.addInteractionEvent(project.id, event, keepalive);
    } catch (error) {
      console.error('保存实验过程事件失败', error);
      window.dispatchEvent(new Event('experiment-event-save-failed'));
    }
  }
}
