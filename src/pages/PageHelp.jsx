const helpContent = [
  {
    id: 'start',
    title: '开始新策展',
    summary: '从上传展品到设定生成参数，再到叙事节奏配置，完成一次新项目初始化。',
    bullets: [
      '上传展品清单并填写展览题目、补充策展意图。',
      '设置 AI 创意程度、单元数量和每单元展品数等生成参数。',
      '通过叙事节奏模板或自定义曲线控制后续方案与文本风格。'
    ]
  },
  {
    id: 'projects',
    title: '我的项目',
    summary: '集中查看进行中与已完成项目，并在同一入口中回看生成配置和各阶段结果。',
    bullets: [
      '点击“继续编辑”可从上次停留的步骤继续工作。',
      '点击“查看”可回顾从新建策展到完整大纲的阶段内容。',
      '项目数据会随过程自动保存，便于多次迭代。'
    ]
  },
  {
    id: 'step1',
    title: 'Step 1 - 叙事方案',
    summary: 'AI 会生成多个叙事方向供你比较和选择，也支持自定义方案。',
    bullets: [
      '对比不同方案的叙事重点、结构逻辑和单元数量。',
      '选择更契合展览目标的方向，或手动补充自己的思路。',
      '如果新建策展阶段已限定题目，方案标题会保持一致。'
    ]
  },
  {
    id: 'step2',
    title: 'Step 2 - 单元编辑',
    summary: '对 AI 给出的单元结构进行审核和微调，确定展览叙事骨架。',
    bullets: [
      '修改单元标题、叙事定位与顺序，补足展览逻辑。',
      '序章与尾声会自动保持在结构两端，正文单元按内容推进组织。',
      '确认结构后进入展品推荐环节。'
    ]
  },
  {
    id: 'step3',
    title: 'Step 3 - 展品推荐',
    summary: '逐个单元审核推荐展品，保留合适项并形成最终展品支撑。',
    bullets: [
      'AI 推荐展品会标注推荐程度，并可展示一句话推荐理由。',
      '你可以保留、删除或从备选列表补充展品。',
      '左侧导航支持快速切换单元，提高审核效率。'
    ]
  },
  {
    id: 'step4',
    title: 'Step 4 - 策展文本',
    summary: '审核 AI 生成的序言、单元文案和尾声，可直接编辑或单段重生成。',
    bullets: [
      '点击文本即可原位编辑，已人工修改内容会以不同底色区分。',
      '支持针对单个段落重新生成，方便局部迭代。',
      '这一阶段重点核对语言风格、学术准确性与逻辑顺序。'
    ]
  },
  {
    id: 'step5',
    title: 'Step 5 - 完整大纲',
    summary: '统一预览完整策展方案，并导出为可交付文档。',
    bullets: [
      '查看完整目录、各单元展品与正文内容的整合结果。',
      '支持 Markdown、Word、PDF 等导出形式。',
      '确认无误后可完成项目，归档至“已完成”列表。'
    ]
  },
  {
    id: 'exhibits',
    title: '展品库',
    summary: '维护全局展品知识库，为多个项目提供可复用的基础素材。',
    bullets: [
      '支持手动新增、编辑、删除展品。',
      '支持批量导入清单，提高录入效率。',
      '后续新项目可直接复用已有展品信息。'
    ]
  },
  {
    id: 'saving',
    title: '数据保存',
    summary: '系统会在关键流程中自动记录数据，降低中断或误操作风险。',
    bullets: [
      '项目过程数据会同步保存到云端数据库。',
      '从“我的项目”返回时，系统会恢复上次编辑进度。',
      '如果涉及登录，项目会与当前用户身份关联。'
    ]
  }
];

export const PageHelp = ({ 
  theme,
}) => {
  const C = theme;
  const quickFacts = [
    { label: '核心流程', value: '5 步完成策展输出' },
    { label: '文稿能力', value: '支持 AI 生成与人工精修' },
    { label: '数据机制', value: '自动保存并支持继续编辑' },
  ];
  const faqItems = [
    {
      q: '调整叙事节奏会影响哪些内容？',
      a: '会优先影响叙事方案、单元结构、序言、正文和尾声的推进方式与文风强弱，但不会直接硬性指定某件展品必须进入哪个单元。'
    },
    {
      q: '为什么有些内容可以重新生成，有些只能手动修改？',
      a: '当前系统更适合对局部 AI 产出进行审核与迭代，因此在叙事方案、展品推荐和文本阶段都提供了不同粒度的再生成入口。'
    },
    {
      q: '如果页面关闭了，项目会丢吗？',
      a: '正常情况下不会。系统会持续保存项目数据，你可以从“我的项目”重新进入并继续编辑。'
    }
  ];
  
  return (
    <main style={{ padding: "28px 36px" }}>
      <div style={{
        padding: "24px 28px",
        borderRadius: 24,
        border: `1px solid ${C.border}`,
        background: `linear-gradient(180deg, ${C.bgElevated || C.bgSecondary} 0%, ${C.bgSecondary} 100%)`,
        boxShadow: "0 18px 40px rgba(15, 23, 42, 0.05)",
        marginBottom: 24,
      }}>
        <div style={{ maxWidth: 780 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            background: `${C.accentPrimary}12`,
            border: `1px solid ${C.accentPrimary}18`,
            color: C.accentPrimary,
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 14,
          }}>
            Help Center
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)", margin: 0 }}>
            帮助中心
          </h1>
          <p style={{ color: C.textSecondary, fontSize: 14, margin: "10px 0 0", lineHeight: 1.8, maxWidth: 720 }}>
            这里汇总了从新建策展到最终导出的完整使用路径，适合第一次上手、流程回看和功能定位时快速查阅。
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 20 }}>
          {quickFacts.map((item) => (
            <div
              key={item.label}
              style={{
                padding: "14px 16px",
                borderRadius: 16,
                border: `1px solid ${C.border}`,
                background: C.bgElevated || C.bgSecondary,
                boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
              }}
            >
              <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, lineHeight: 1.6 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <aside style={{
          position: "sticky",
          top: 24,
          width: 260,
          flexShrink: 0,
          borderRadius: 20,
          border: `1px solid ${C.border}`,
          background: C.bgElevated || C.bgSecondary,
          boxShadow: "0 14px 30px rgba(15, 23, 42, 0.04)",
          padding: "18px 16px",
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)", marginBottom: 12 }}>
            快速导航
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {helpContent.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: 12,
                  color: C.textPrimary,
                  textDecoration: "none",
                  background: C.bgPrimary,
                  border: `1px solid ${C.border}`,
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {item.title}
              </a>
            ))}
          </div>
        </aside>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minWidth: 320 }}>
          {helpContent.map((item) => (
            <section
              key={item.id}
              id={item.id}
              style={{
                borderRadius: 20,
                border: `1px solid ${C.border}`,
                background: C.bgElevated || C.bgSecondary,
                boxShadow: "0 14px 30px rgba(15, 23, 42, 0.04)",
                padding: "20px 22px",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)", marginBottom: 8 }}>
                {item.title}
              </div>
              <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.8, marginBottom: 14 }}>
                {item.summary}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {item.bullets.map((bullet) => (
                  <div
                    key={bullet}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 14,
                      background: C.bgPrimary,
                      border: `1px solid ${C.border}`,
                      fontSize: 13,
                      color: C.textPrimary,
                      lineHeight: 1.7,
                    }}
                  >
                    {bullet}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section style={{
            borderRadius: 20,
            border: `1px solid ${C.border}`,
            background: C.bgElevated || C.bgSecondary,
            boxShadow: "0 14px 30px rgba(15, 23, 42, 0.04)",
            padding: "20px 22px",
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, fontFamily: "var(--font-serif)", marginBottom: 12 }}>
              常见问题
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {faqItems.map((item) => (
                <div
                  key={item.q}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 16,
                    background: C.bgPrimary,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>{item.q}</div>
                  <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.8 }}>{item.a}</div>
                </div>
              ))}
            </div>
          </section>

          <div style={{
            padding: "18px 20px",
            background: C.aiGenerated,
            borderRadius: 18,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: C.textPrimary }}>需要更多帮助？</div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.8 }}>
              如果遇到账号、导出或数据异常问题，可以优先回到“我的项目”核对当前状态，再联系系统管理员或查看项目文档继续排查。
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
