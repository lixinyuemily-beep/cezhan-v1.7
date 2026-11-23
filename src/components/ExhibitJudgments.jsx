const fieldLabels = { date: '年代', place: '地点', material: '材质', description: '介绍' };

function sourceUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
      ? url.href : null;
  } catch {
    return null;
  }
}

export function ExhibitJudgments({ judgments }) {
  if (!judgments?.length) return <small>逐句依据待核实</small>;

  return (
    <details style={{ marginTop: 6 }}>
      <summary>逐句依据</summary>
      <ol style={{ paddingInlineStart: 24 }}>
        {judgments.map((judgment, index) => (
          <li key={index} style={{ marginBottom: 8 }}>
            <div>{judgment.text}</div>
            {judgment.kind === 'interpretation' && <small>阐释 · 由策展人判断</small>}
            {judgment.references?.length ? (
              <ul style={{ paddingInlineStart: 18 }}>
                {judgment.references.map(reference => {
                  const url = sourceUrl(reference.url);
                  return (
                    <li key={`${reference.sourceId}:${reference.field}`}>
                      {reference.label} · {reference.locator} · {fieldLabels[reference.field] || reference.field}
                      <div>{reference.value}</div>
                      {url && <a href={url} target="_blank" rel="noopener noreferrer">打开原始记录</a>}
                    </li>
                  );
                })}
              </ul>
            ) : <small>未对应到可定位依据，待核实</small>}
          </li>
        ))}
      </ol>
    </details>
  );
}
