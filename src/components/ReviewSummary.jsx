import { Btn } from './ui';

const grades = [
  { key: 'blocking', label: '优先复核' },
  { key: 'warning', label: '资料待核对' },
  { key: 'info', label: '文本待审阅' },
];

export function ReviewSummary({ notices, onOpen, C }) {
  return (
    <section aria-label="本阶段审核汇总" style={{ marginBottom: 20, padding: 16, border: `1px solid ${C.border}`, borderRadius: 16 }}>
      <h2 style={{ fontSize: 17, margin: '0 0 10px' }}>本阶段审核汇总</h2>
      {notices.length === 0 && <p>当前没有待处理的审核提示。</p>}
      {grades.map(grade => {
        const items = notices.filter(notice => notice.grade === grade.key);
        if (!items.length) return null;
        return (
          <details key={grade.key} open={grade.key === 'blocking' || undefined}>
            <summary>{grade.label} · {items.length} 项</summary>
            <ul style={{ paddingInlineStart: 24 }}>
              {items.map(notice => (
                <li key={notice.id} style={{ marginBottom: 6 }}>
                  <Btn small variant="ghost" onClick={() => onOpen(notice)}>
                    {notice.title} · {notice.label}
                  </Btn>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </section>
  );
}
