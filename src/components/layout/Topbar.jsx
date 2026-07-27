import { useEffect, useRef, useState } from 'react';
import { STEPS } from '../../constants/theme';
import { Btn } from '../ui';

export const Topbar = ({
  currentStep,
  currentPage,
  currentProject,
  setShowExport,
  goToStep,
  authUser,
  authInitialized,
  authPanelOpen,
  setAuthPanelOpen,
  authPromptMessage,
  setAuthPromptMessage,
  sendEmailCode,
  verifyEmailCode,
  logout,
  showToast,
  theme,
}) => {
  const C = theme;
  const isOnStepPage = currentPage.startsWith('step');
  const completedStep = Math.max(Number(currentProject?.step || 0), Number(currentStep || 0));
  const canExport = completedStep >= 5;
  const topbarTitle = isOnStepPage ? (currentProject?.title || '智能策展助手') : '';
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [codeSentEmail, setCodeSentEmail] = useState('');
  const [form, setForm] = useState({ email: '', code: '' });
  const panelRef = useRef(null);
  const isLoggedIn = !!authUser;
  const avatarText = authUser?.display_name?.slice(0, 1)?.toUpperCase() || authUser?.email?.slice(0, 1)?.toUpperCase() || '访';

  useEffect(() => {
    if (!authPanelOpen) return undefined;
    const handleMouseDown = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setAuthPanelOpen(false);
      }
    };
    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [authPanelOpen, setAuthPanelOpen]);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const handleStepClick = (step) => {
    if (step <= completedStep && step !== currentStep) {
      goToStep(step);
    }
  };

  const handleExportClick = () => {
    if (canExport) {
      setShowExport(true);
    }
  };

  const resetForm = () => {
    setForm({ email: '', code: '' });
    setCodeSentEmail('');
    setCountdown(0);
  };

  const handleSendCode = async () => {
    const email = form.email.trim();
    if (!email) {
      showToast('请先填写邮箱', 'warning');
      return;
    }

    setIsSendingCode(true);
    try {
      const result = await sendEmailCode(email);
      if (result?.success) {
        setCodeSentEmail(result.email || email);
        setCountdown(60);
        setAuthPromptMessage('');
      }
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleAuthSubmit = async () => {
    const email = form.email.trim();
    const code = form.code.trim();

    if (!email || !code) {
      showToast('请填写邮箱和验证码', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await verifyEmailCode(email, code);
      if (result?.success) {
        setAuthPanelOpen(false);
        resetForm();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <header style={{
      position: 'fixed', top: 0, left: 232, right: 0, height: 52,
      background: C.bgElevated || C.bgSecondary, borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      zIndex: 99, padding: '0 28px',
      backdropFilter: 'blur(14px)',
      boxShadow: '0 4px 20px rgba(16, 24, 40, 0.04)',
    }}>
      <span style={{ fontSize: 12, color: C.textSecondary, letterSpacing: '0.02em' }}>
        {topbarTitle}
      </span>

      {isOnStepPage && (
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 0 }}>
          {STEPS.map((label, i) => {
            const n = i + 1;
            const isActive = n === currentStep;
            const isAvailable = n <= completedStep;
            const isDone = isAvailable && !isActive;
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  onClick={() => handleStepClick(n)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    cursor: isAvailable && !isActive ? 'pointer' : 'default', gap: 3,
                  }}
                  title={isAvailable && !isActive ? `跳转到 ${label}` : ''}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: isActive ? C.accentPrimary : isDone ? C.success : C.stepInactive,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, color: '#fff', fontWeight: 700,
                    transition: 'background 0.2s',
                    boxShadow: isActive ? `0 6px 14px ${C.accentPrimary}26` : 'none',
                  }}>{isDone ? '✓' : n}</div>
                  <span style={{
                    fontSize: 10, whiteSpace: 'nowrap',
                    color: isActive ? C.accentPrimary : C.textSecondary,
                    fontWeight: isActive ? 700 : 400,
                  }}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{
                    width: 100, height: 2, margin: '0 4px', marginTop: -10,
                    background: n < completedStep ? C.success : C.stepInactive,
                    transition: 'background 0.2s',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isOnStepPage && <span style={{ fontSize: 12, color: C.success, fontWeight: 600 }}>✓ 已自动保存</span>}
        {isOnStepPage && (
          <Btn
            small
            disabled={!canExport}
            onClick={handleExportClick}
          >
            导出大纲
          </Btn>
        )}
        <div ref={panelRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setAuthPanelOpen(prev => !prev)}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: isLoggedIn
                ? `linear-gradient(135deg, ${C.accentPrimary} 0%, ${C.sidebarAccent || C.accentPrimary} 100%)`
                : `linear-gradient(135deg, ${C.accentSecondary} 0%, ${C.accentPrimary} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              border: 'none',
              cursor: 'pointer',
              boxShadow: C.shadowSm,
            }}
            title={isLoggedIn ? `当前账号：${authUser.email || authUser.id}` : '点击登录'}
          >
            {avatarText}
          </button>

          {authPanelOpen && (
            <div style={{
              position: 'absolute',
              top: 40,
              right: 0,
              width: 320,
              background: C.bgElevated || '#fff',
              border: `1px solid ${C.border}`,
              borderRadius: 18,
              boxShadow: C.shadowLg,
              padding: 18,
              zIndex: 130,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>
                {isLoggedIn ? '账户信息' : '邮箱验证码登录'}
              </div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 14, lineHeight: 1.6 }}>
                {isLoggedIn
                  ? `当前已登录：${authUser.email || authUser.display_name || '未命名账号'}`
                  : authInitialized
                    ? '当前为访客预览模式：可浏览界面，但不会加载项目和展品数据。'
                    : '正在恢复登录状态...'}
              </div>

              {!isLoggedIn && authPromptMessage && (
                <div style={{
                  fontSize: 12,
                  color: C.accentPrimary,
                  background: `${C.accentPrimary}10`,
                  border: `1px solid ${C.accentPrimary}22`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  lineHeight: 1.6,
                  marginBottom: 14,
                }}>
                  {authPromptMessage}
                </div>
              )}

              {isLoggedIn ? (
                <>
                  <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.8, marginBottom: 14 }}>
                    <div>邮箱：{authUser.email || '-'}</div>
                    <div>昵称：{authUser.display_name || '-'}</div>
                    <div>用户 ID：{authUser.id || '-'}</div>
                  </div>
                  <Btn small variant="ghost" onClick={() => {
                    logout();
                    setAuthPanelOpen(false);
                  }} style={{ width: '100%' }}>
                    退出登录
                  </Btn>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    type="email"
                    placeholder="请输入邮箱"
                    value={form.email}
                    onChange={(event) => setForm(prev => ({ ...prev, email: event.target.value }))}
                    style={{
                      width: '100%',
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="请输入验证码"
                      value={form.code}
                      onChange={(event) => setForm(prev => ({ ...prev, code: event.target.value }))}
                      style={{
                        flex: 1,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: '10px 12px',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      onClick={handleSendCode}
                      disabled={isSendingCode || countdown > 0 || !authInitialized}
                      style={{
                        width: 112,
                        border: 'none',
                        borderRadius: 8,
                        padding: '0 10px',
                        cursor: isSendingCode || countdown > 0 || !authInitialized ? 'not-allowed' : 'pointer',
                        background: isSendingCode || countdown > 0 ? C.bgSecondary : C.accentPrimary,
                        color: isSendingCode || countdown > 0 ? C.textSecondary : '#fff',
                        fontWeight: 700,
                        fontSize: 12,
                        opacity: authInitialized ? 1 : 0.7,
                      }}
                    >
                      {isSendingCode ? '发送中...' : countdown > 0 ? `${countdown}s后重发` : '发送验证码'}
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6 }}>
                    {codeSentEmail
                      ? `验证码已发送至 ${codeSentEmail}，未注册邮箱将自动创建账号。`
                      : '输入邮箱后获取验证码邮件，验证成功后自动登录。'}
                  </div>
                  <Btn small onClick={handleAuthSubmit} disabled={isSubmitting || !authInitialized} style={{ width: '100%' }}>
                    {isSubmitting ? '验证中...' : '验证并登录'}
                  </Btn>
                  <div style={{
                    fontSize: 11,
                    color: C.textSecondary,
                    background: C.bgSecondary,
                    borderRadius: 8,
                    padding: '10px 12px',
                    lineHeight: 1.6,
                  }}>
                    首次使用邮箱登录时，系统会自动创建账号并同步用户资料。
                  </div>
                  <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.6 }}>
                    登录后只能查看和编辑你自己的策展项目与展品库内容。
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
