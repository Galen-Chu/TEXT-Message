import { useState } from 'react';
import {
  COPY_CATEGORIES,
  DRAFT_AI_COPY,
  DRAFT_KIND_HINT,
  DRAFT_KIND_META,
  DRAFT_SAVE_COPY,
  DRAFT_VARIANTS_COPY,
  DRIVE_COPY,
  FAMILY_COPY,
  GEMINI_KEY_MODAL,
  GEMINI_MODE_LABEL,
  LANGUAGE_OPTIONS,
  PLATFORM_LIST,
  PLATFORM_META,
  ROLE_OPTIONS,
  TONE_OPTIONS,
} from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import { charCount, dateLabel } from '../utils/date';
import { buildTemplateInsertText } from '../utils/variants';
import { extractVariables } from '../utils/variables';
import type { Template } from '../types';
import Modal from './Modal';
import GeminiKeyModal from './GeminiKeyModal';
import PublishCard from './PublishCard';
import VariableFillModal from './VariableFillModal';

export default function Draft({ store }: { store: AppStore }) {
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showSocialPicker, setShowSocialPicker] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [customInstruction, setCustomInstruction] = useState('');
  const [fillInsert, setFillInsert] = useState<{ tpl: Template; text: string } | null>(null);
  const [showVariantSave, setShowVariantSave] = useState(false);
  const [variantSaveTitle, setVariantSaveTitle] = useState('');
  const [variantSaveCategory, setVariantSaveCategory] = useState(
    COPY_CATEGORIES.find((c) => c !== '全部') ?? '日常分享',
  );

  const variantPlatforms = PLATFORM_LIST.filter(
    (p) => store.draftVariants && p.key in store.draftVariants,
  );

  const hasDraftTarget = !!store.selectedMailId;
  const sourceMail =
    store.selectedMailId && store.selectedMailId !== 'blank'
      ? store.emails.find((e) => e.id === store.selectedMailId)
      : null;

  const draftLength = charCount(store.draftText);

  return (
    <div>
      <div className="t-page-title" style={{ marginBottom: 4 }}>
        編發器 Draft
      </div>
      <div className="t-page-desc" style={{ marginBottom: 20 }}>
        撰寫與 AI 潤飾貼文,依平台產生版本;儲存文體歸檔文庫,發佈與排程同頁完成
      </div>

      {!hasDraftTarget && (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div className="t-emoji-art" style={{ marginBottom: 12 }}>
            📝
          </div>
          <div className="t-card-title" style={{ marginBottom: 6 }}>
            還沒有選擇內容來源
          </div>
          <div className="t-body" style={{ color: 'var(--text-weak)', marginBottom: 20 }}>
            從 Gmail 挑一封信、社群媒體歷史貼文轉成草稿,或直接空白開始撰寫
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={() => store.setActiveTab('inbox')}>
              前往郵件匣挑選
            </button>
            <button className="btn btn-outline" onClick={() => setShowSocialPicker(true)}>
              從社群媒體挑選
            </button>
            <button className="btn btn-primary" onClick={store.startBlankDraft}>
              空白草稿開始撰寫
            </button>
          </div>
        </div>
      )}

      {hasDraftTarget && (
        <div className="draft-layout" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {!sourceMail && store.selectedMailId !== 'blank' && (
            <div className="card draft-source t-sub" style={{ padding: 18 }}>
              來源郵件已不在清單中(可能已中斷連線或重新整理)
            </div>
          )}
          {sourceMail && (
            <div className="card draft-source" style={{ padding: 18 }}>
              <div
                className="t-meta"
                style={{
                  fontWeight: 'var(--weight-bold)',
                  color: 'var(--text-weak)',
                  marginBottom: 10,
                  letterSpacing: 0.5,
                }}
              >
                原始郵件參考
              </div>
              <div className="t-sec-title">{sourceMail.subject}</div>
              <div className="t-meta" style={{ margin: '4px 0 10px 0' }}>
                {sourceMail.sender} · {sourceMail.date}
              </div>
              <div
                className="t-sub"
                style={{
                  color: 'var(--text-sub)',
                  lineHeight: 'var(--leading-normal)',
                  maxHeight: 340,
                  overflowY: 'auto',
                  whiteSpace: 'pre-line',
                }}
              >
                {sourceMail.fullBody}
              </div>
            </div>
          )}

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 18 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="t-sub" style={{ fontWeight: 'var(--weight-bold)' }}>
                    {store.aiBusy
                      ? GEMINI_MODE_LABEL.busy
                      : store.geminiKey
                        ? GEMINI_MODE_LABEL.on
                        : GEMINI_MODE_LABEL.off}
                  </div>
                  {store.aiBusy && (
                    <button
                      onClick={store.stopAi}
                      className="t-sub"
                      style={{ fontWeight: 'var(--weight-bold)', color: 'var(--error)' }}
                    >
                      {GEMINI_MODE_LABEL.stopButton}
                    </button>
                  )}
                </div>
                {store.driveStyleSamples.length > 0 && (
                  <button
                    onClick={() => store.setDriveStyleEnabled(!store.driveStyleEnabled)}
                    title={DRIVE_COPY.styleHint}
                    className="t-meta"
                    style={{
                      marginTop: 6,
                      alignSelf: 'flex-start',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontWeight: 'var(--weight-bold)',
                      background: store.driveStyleEnabled ? 'var(--pill-brand-bg)' : 'var(--card)',
                      color: store.driveStyleEnabled ? 'var(--brand)' : 'var(--text-faint)',
                      border: `1px solid ${store.driveStyleEnabled ? 'var(--brand)' : 'var(--border-3)'}`,
                    }}
                  >
                    {store.driveStyleEnabled ? '✓ ' : ''}
                    {DRIVE_COPY.styleToggleLabel(store.driveStyleSamples.length)}
                  </button>
                )}
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => void store.generateDraftVariants()}
                    className="t-sub"
                    style={{ fontWeight: 'var(--weight-bold)', color: 'var(--brand)' }}
                  >
                    {DRAFT_VARIANTS_COPY.variantsButton}
                  </button>
                  <button
                    onClick={() => void store.requestHashtags()}
                    className="t-sub"
                    style={{ fontWeight: 'var(--weight-bold)', color: 'var(--brand)' }}
                  >
                    {DRAFT_VARIANTS_COPY.hashtagsButton}
                  </button>
                  <button
                    onClick={() => setShowKeyModal(true)}
                    className="t-sub"
                    style={{ fontWeight: 'var(--weight-bold)', color: 'var(--brand)' }}
                  >
                    ⚙️ AI 設定
                  </button>
                  <button
                    onClick={() => setShowTemplatePicker(true)}
                    className="t-sub"
                    style={{ fontWeight: 'var(--weight-bold)', color: 'var(--brand)' }}
                  >
                    📋 從文庫插入
                  </button>
                  <button
                    onClick={() => setShowSocialPicker(true)}
                    className="t-sub"
                    style={{ fontWeight: 'var(--weight-bold)', color: 'var(--brand)' }}
                  >
                    📣 從社群媒體挑選
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TONE_OPTIONS.map((tone) => (
                  <button
                    key={tone}
                    onClick={() => void store.applyTone(tone)}
                    disabled={store.aiBusy}
                    className="t-sub"
                    style={{
                      padding: '7px 14px',
                      borderRadius: 9,
                      fontWeight: 'var(--weight-semibold)',
                      background: 'var(--bg)',
                      color: 'var(--brand)',
                      border: '1px solid var(--pill-brand-bg-2)',
                      opacity: store.aiBusy ? 0.5 : 1,
                      cursor: store.aiBusy ? 'wait' : 'pointer',
                    }}
                  >
                    {tone}
                  </button>
                ))}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  marginTop: 10,
                }}
              >
                <span className="t-meta" style={{ fontWeight: 'var(--weight-bold)' }}>
                  {DRAFT_AI_COPY.roleRowLabel}
                </span>
                {[null, ...ROLE_OPTIONS].map((role) => {
                  const active = store.aiRole === role;
                  return (
                    <button
                      key={role ?? 'doc-default'}
                      onClick={() => store.selectAiRole(role)}
                      disabled={store.aiBusy}
                      className="t-sub"
                      style={{
                        padding: '6px 12px',
                        borderRadius: 9,
                        fontWeight: 'var(--weight-semibold)',
                        background: active ? 'var(--pill-brand-bg)' : 'var(--bg)',
                        color: active ? 'var(--brand)' : 'var(--text-faint)',
                        border: `1px solid ${active ? 'var(--brand)' : 'var(--pill-brand-bg-2)'}`,
                        opacity: store.aiBusy ? 0.5 : 1,
                        cursor: store.aiBusy ? 'wait' : 'pointer',
                      }}
                    >
                      {role ?? DRAFT_AI_COPY.roleDefault}
                    </button>
                  );
                })}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  marginTop: 10,
                }}
              >
                <span className="t-meta" style={{ fontWeight: 'var(--weight-bold)' }}>
                  {DRAFT_AI_COPY.langRowLabel}
                </span>
                {LANGUAGE_OPTIONS.map((lang) => {
                  const active = store.aiLanguage === lang;
                  return (
                    <button
                      key={lang}
                      onClick={() => store.selectAiLanguage(lang)}
                      disabled={store.aiBusy}
                      className="t-sub"
                      style={{
                        padding: '6px 12px',
                        borderRadius: 9,
                        fontWeight: 'var(--weight-semibold)',
                        background: active ? 'var(--pill-brand-bg)' : 'var(--bg)',
                        color: active ? 'var(--brand)' : 'var(--text-faint)',
                        border: `1px solid ${active ? 'var(--brand)' : 'var(--pill-brand-bg-2)'}`,
                        opacity: store.aiBusy ? 0.5 : 1,
                        cursor: store.aiBusy ? 'wait' : 'pointer',
                      }}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  className="text-input"
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void store.applyCustomInstruction(customInstruction);
                  }}
                  placeholder={DRAFT_AI_COPY.customInstructionPlaceholder}
                  aria-label={DRAFT_AI_COPY.customInstructionLabel}
                  style={{ flex: 1, borderRadius: 9, padding: '8px 12px', fontSize: 'var(--text-sub)' }}
                />
                <button
                  onClick={() => void store.applyCustomInstruction(customInstruction)}
                  disabled={store.aiBusy}
                  className="t-sub"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 9,
                    fontWeight: 'var(--weight-bold)',
                    background: 'var(--pill-brand-bg)',
                    color: 'var(--brand)',
                    opacity: store.aiBusy ? 0.5 : 1,
                    cursor: store.aiBusy ? 'wait' : 'pointer',
                  }}
                >
                  {DRAFT_AI_COPY.customInstructionApply}
                </button>
              </div>
            </div>

            {store.hashtagSuggestions.length > 0 && (
              <div
                className="card"
                style={{
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span className="t-meta">標籤建議:</span>
                {store.hashtagSuggestions.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => store.addHashtagsToDraft([tag])}
                    className="t-sub"
                    style={{
                      padding: '5px 12px',
                      borderRadius: 9,
                      fontWeight: 'var(--weight-semibold)',
                      background: 'var(--pill-brand-bg)',
                      color: 'var(--brand)',
                      border: '1px solid var(--pill-brand-bg-2)',
                    }}
                  >
                    {tag}
                  </button>
                ))}
                <button
                  onClick={() => {
                    store.addHashtagsToDraft(store.hashtagSuggestions);
                    store.clearHashtagSuggestions();
                  }}
                  className="t-sub"
                  style={{ fontWeight: 'var(--weight-bold)', color: 'var(--brand)' }}
                >
                  {DRAFT_VARIANTS_COPY.hashtagsAddAll}
                </button>
                <button
                  onClick={store.clearHashtagSuggestions}
                  aria-label="關閉標籤建議"
                  className="t-emoji-sm"
                  style={{ color: 'var(--text-faint)', marginLeft: 'auto' }}
                >
                  ✕
                </button>
              </div>
            )}

            <div className="card" style={{ padding: 18 }}>
              <textarea
                value={store.draftText}
                onChange={(e) => store.setDraftText(e.target.value)}
                placeholder="開始撰寫你的貼文內容…"
                style={{
                  width: '100%',
                  minHeight: 160,
                  border: '1px solid var(--border-3)',
                  borderRadius: 12,
                  padding: 14,
                  /* 主要撰寫區刻意用卡片級(15px)而非內文級:這是全站唯一的長文輸入面 */
                  fontSize: 'var(--text-card)',
                  fontFamily: 'inherit',
                  lineHeight: 'var(--leading-normal)',
                  color: 'var(--text-main)',
                  resize: 'vertical',
                }}
              />
              <div className="t-meta t-num" style={{ textAlign: 'right', marginTop: 6 }}>
                {draftLength} 字
              </div>
            </div>

            {store.draftVariants && (
              <div className="card" style={{ padding: 18 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <div className="t-sec-title">{DRAFT_VARIANTS_COPY.variantsTitle}</div>
                  <button
                    onClick={store.clearDraftVariants}
                    aria-label={DRAFT_VARIANTS_COPY.variantsClose}
                    className="t-emoji-sm"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    ✕
                  </button>
                </div>
                <div className="t-meta" style={{ marginBottom: 12 }}>
                  {DRAFT_VARIANTS_COPY.variantsHint}
                </div>
                {variantPlatforms.map((p) => {
                  const value = store.draftVariants?.[p.key] ?? '';
                  const over = charCount(value) > p.limit;
                  return (
                    <div key={p.key} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 5,
                            background: p.color,
                            color: '#fff',
                            fontSize: 'var(--text-micro)',
                            fontWeight: 'var(--weight-bold)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {p.badge}
                        </span>
                        <span className="t-sub" style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-main)' }}>
                          {p.label} 版
                        </span>
                        <span
                          className="t-meta t-num"
                          style={{
                            color: over ? 'var(--error)' : 'var(--text-faint)',
                            marginLeft: 'auto',
                          }}
                        >
                          {charCount(value)} / {p.limit} 字
                        </span>
                      </div>
                      <textarea
                        className="text-input"
                        value={value}
                        onChange={(e) => store.setDraftVariant(p.key, e.target.value)}
                        style={{ minHeight: 88, lineHeight: 'var(--leading-snug)', resize: 'vertical' }}
                      />
                    </div>
                  );
                })}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-accent"
                    style={{ borderRadius: 9 }}
                    onClick={store.appendDraftVariantsToDraft}
                  >
                    {DRAFT_VARIANTS_COPY.variantsAppend}
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{ borderRadius: 9 }}
                    onClick={() => {
                      setVariantSaveTitle(store.draftText.split('\n')[0].slice(0, 24) || '未命名範本');
                      setShowVariantSave(true);
                    }}
                  >
                    {DRAFT_VARIANTS_COPY.variantsSave}
                  </button>
                </div>
              </div>
            )}

            <div className="card" style={{ padding: 18 }}>
              <div className="t-sec-title" style={{ marginBottom: 12 }}>
                {DRAFT_KIND_HINT}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {DRAFT_KIND_META.map((k) => {
                  const active = store.draftKind === k.key;
                  return (
                    <button
                      key={k.key}
                      onClick={() => store.setDraftKind(k.key)}
                      className="t-sub"
                      style={{
                        padding: '8px 14px',
                        borderRadius: 9,
                        fontWeight: 'var(--weight-semibold)',
                        background: active ? 'var(--pill-brand-bg)' : 'var(--card)',
                        color: active ? 'var(--brand)' : 'var(--text-faint)',
                        border: `1px solid ${active ? 'var(--brand)' : 'var(--pill-brand-bg-2)'}`,
                      }}
                    >
                      {k.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  onClick={store.discardDraft}
                  className="t-sub"
                  style={{
                    padding: '9px 14px',
                    borderRadius: 9,
                    fontWeight: 'var(--weight-bold)',
                    color: 'var(--error)',
                    background: 'var(--bg)',
                  }}
                >
                  {DRAFT_SAVE_COPY.deleteButton}
                </button>
                <button
                  className="btn btn-outline"
                  style={{ padding: '9px 16px', fontSize: 'var(--text-sub)' }}
                  onClick={store.saveDraft}
                >
                  {DRAFT_SAVE_COPY.saveButton}
                </button>
                {/* U3 交接:把目前緩衝的文案送到媒管庫媒庫收件匣,當圖片/影片的說明 */}
                <button
                  className="btn btn-outline"
                  style={{ padding: '9px 16px', fontSize: 'var(--text-sub)' }}
                  onClick={() => store.sendToMediaMessage(store.draftText)}
                  title={FAMILY_COPY.sendTitle}
                >
                  {FAMILY_COPY.sendButton}
                </button>
              </div>
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div className="t-sec-title" style={{ marginBottom: 12 }}>
                選擇發布平台
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {PLATFORM_LIST.map((p) => {
                  const active = store.draftPlatforms[p.key];
                  return (
                    <button
                      key={p.key}
                      onClick={() => store.togglePlatform(p.key)}
                      className="t-sub"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '8px 14px',
                        borderRadius: 9,
                        fontWeight: 'var(--weight-semibold)',
                        background: active ? 'var(--pill-brand-bg)' : 'var(--card)',
                        color: active ? 'var(--brand)' : 'var(--text-faint)',
                        border: `1px solid ${active ? 'var(--brand)' : 'var(--pill-brand-bg-2)'}`,
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          background: p.color,
                          color: '#fff',
                          fontSize: 'var(--text-micro)',
                          fontWeight: 'var(--weight-bold)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {p.badge}
                      </span>
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>

            </div>

            <PublishCard store={store} />
          </div>
        </div>
      )}

      {showKeyModal && (
        <GeminiKeyModal
          label={GEMINI_KEY_MODAL.title}
          hasKey={!!store.geminiKey}
          onSave={(key) => {
            store.setGeminiKey(key);
            store.showToast(GEMINI_KEY_MODAL.savedToast);
          }}
          onClear={() => {
            store.setGeminiKey('');
            store.showToast(GEMINI_KEY_MODAL.clearedToast);
          }}
          onClose={() => setShowKeyModal(false)}
        />
      )}

      {fillInsert && (
        <VariableFillModal
          text={fillInsert.text}
          onClose={() => setFillInsert(null)}
          onApply={(values) => {
            store.insertTemplateIntoDraft(fillInsert.tpl, values);
            setFillInsert(null);
          }}
        />
      )}

      {showVariantSave && (
        <Modal
          onClose={() => setShowVariantSave(false)}
          width={420}
          label={DRAFT_VARIANTS_COPY.variantsSaveTitle}
        >
          <div className="t-card-title" style={{ marginBottom: 16 }}>
            {DRAFT_VARIANTS_COPY.variantsSaveTitle}
          </div>
          <div className="field-label">標題</div>
          <input
            className="text-input"
            value={variantSaveTitle}
            onChange={(e) => setVariantSaveTitle(e.target.value)}
            style={{ marginBottom: 14 }}
          />
          <div className="field-label">{DRAFT_VARIANTS_COPY.variantsSaveCategory}</div>
          <select
            className="text-input"
            value={variantSaveCategory}
            onChange={(e) => setVariantSaveCategory(e.target.value)}
            style={{ marginBottom: 16 }}
          >
            {COPY_CATEGORIES.filter((c) => c !== '全部').map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="t-note" style={{ marginBottom: 16 }}>
            通用內容 = 目前草稿全文;平台版本 = 面板中的各版(存入後可於文庫編輯)
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              className="btn btn-ghost"
              style={{ borderRadius: 9 }}
              onClick={() => setShowVariantSave(false)}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              style={{ borderRadius: 9 }}
              onClick={() => {
                if (!variantSaveTitle.trim()) {
                  store.showToast('請輸入標題');
                  return;
                }
                store.saveDraftVariantsAsTemplate(variantSaveTitle.trim(), variantSaveCategory);
                setShowVariantSave(false);
              }}
            >
              存入文庫
            </button>
          </div>
        </Modal>
      )}

      {showTemplatePicker && (
        <Modal
          onClose={() => setShowTemplatePicker(false)}
          width={480}
          label="插入文庫內容"
          style={{ maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <div className="t-card-title">插入文庫內容</div>
            <button
              onClick={() => setShowTemplatePicker(false)}
              aria-label="關閉"
              className="t-emoji-sm"
              style={{ color: 'var(--text-faint)' }}
            >
              ✕
            </button>
          </div>
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...store.templates, ...store.copyTemplates].map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => {
                  const selected = PLATFORM_LIST.filter((p) => store.draftPlatforms[p.key]).map(
                    (p) => p.key,
                  );
                  const text = buildTemplateInsertText(tpl, selected);
                  if (extractVariables(text).length > 0) {
                    setFillInsert({ tpl, text });
                  } else {
                    store.insertTemplateIntoDraft(tpl);
                  }
                  setShowTemplatePicker(false);
                }}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  border: '1px solid var(--border-2)',
                  borderRadius: 10,
                }}
              >
                <div className="t-sub" style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-main)' }}>
                  {tpl.title}
                </div>
                <div
                  className="t-meta"
                  style={{ color: 'var(--text-weak)', marginTop: 4, whiteSpace: 'pre-line' }}
                >
                  {tpl.text}
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {showSocialPicker && (
        <Modal
          onClose={() => setShowSocialPicker(false)}
          width={480}
          label="從社群媒體挑選"
          style={{ maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <div className="t-card-title">從社群媒體挑選</div>
            <button
              onClick={() => setShowSocialPicker(false)}
              aria-label="關閉"
              className="t-emoji-sm"
              style={{ color: 'var(--text-faint)' }}
            >
              ✕
            </button>
          </div>
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {store.socialHistory.map((post) => (
              <button
                key={post.id}
                onClick={() => {
                  store.pickSocialPost(post);
                  setShowSocialPicker(false);
                }}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  border: '1px solid var(--border-2)',
                  borderRadius: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div className="t-sub" style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-main)' }}>
                    {post.title}
                  </div>
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      background: PLATFORM_META[post.platform].color,
                      color: '#fff',
                      fontSize: 'var(--text-micro)',
                      fontWeight: 'var(--weight-bold)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {PLATFORM_META[post.platform].badge}
                  </span>
                </div>
                <div
                  className="t-meta"
                  style={{ color: 'var(--text-weak)', marginTop: 4, whiteSpace: 'pre-line' }}
                >
                  {post.content}
                </div>
                <div className="t-meta t-num" style={{ marginTop: 4 }}>
                  {dateLabel(post.date)}
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

    </div>
  );
}
