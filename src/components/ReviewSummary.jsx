import { Btn } from './ui';

const grades = [
  { key: 'blocking', label: '优先复核' },
  { key: 'warning', label: '资料待核对' },
  { key: 'info', label: '文本待审阅' },
];

export function ReviewSummary({ notices, includesExhibitChecks, onOpen, C }) {
  return (
    <section aria-label="本阶段审核汇总" style={{ marginBottom: 20, padding: 16, border: `1px solid ${C.border}`, borderRadius: 16 }}>
      <h2 style={{ fontSize: 17, margin: '0 0 10px' }}>本阶段审核汇总</h2>
      <p style={{ margin: '0 0 10px', color: C.textSecondary }}>
        核对范围为当前大纲的待审阅文本和已登记的展品关联变更。
        {includesExhibitChecks && '在有展品说明的单元，还检查已提供的资料缺项、结构化字段冲突和依据是否可定位。'}
        正文中的未登记引用、史实真伪与论证是否成立由策展人复核。
      </p>
      {notices.length === 0 && <p>上述核对范围内暂无待处理提示。</p>}
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
