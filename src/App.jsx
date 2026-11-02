import { useEffect, useMemo, useRef, useState } from 'react';
import { generateSentenceWithQwen } from './api/qwen';
import {
  imageItems as defaultImageItems,
  pronouns as defaultPronouns,
  verbs as defaultVerbs
} from './data/items';

const TEACHER_STORAGE_KEY = 'kids_sentence_teacher_config_v1';

function createDefaultConfig() {
  return {
    items: defaultImageItems.map((item) => ({ ...item })),
    pronouns: [...defaultPronouns],
    verbs: [...defaultVerbs]
  };
}

function normalizeItems(rawItems, fallbackItems) {
  if (!Array.isArray(rawItems)) {
    return fallbackItems;
  }

  if (rawItems.length === 0) {
    return [];
  }

  const usedIds = new Set();

  return rawItems.map((rawItem, index) => {
    const rawId = Number(rawItem?.id);
    let id = Number.isFinite(rawId) ? Math.trunc(rawId) : index;
    while (usedIds.has(id)) {
      id += 1;
    }
    usedIds.add(id);

    return {
      id,
      image: String(rawItem?.image ?? '').trim() || '/images/0.webp',
      name: String(rawItem?.name ?? '').trim(),
      category: String(rawItem?.category ?? '').trim()
    };
  });
}

function normalizeWords(rawWords, fallbackWords) {
  if (!Array.isArray(rawWords)) {
    return fallbackWords;
  }

  if (rawWords.length === 0) {
    return [];
  }

  return rawWords.map((word) => String(word ?? ''));
}

function loadTeacherConfig() {
  const fallback = createDefaultConfig();

  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(TEACHER_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);

    return {
      items: normalizeItems(parsed?.items, fallback.items),
      pronouns: normalizeWords(parsed?.pronouns, fallback.pronouns),
      verbs: normalizeWords(parsed?.verbs, fallback.verbs)
    };
  } catch (_err) {
    return fallback;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

function getNameFromFileName(fileName) {
  const baseName = String(fileName || '')
    .replace(/\.[^/.]+$/, '')
    .trim();

  return baseName || '未命名物品';
}

function OptionGroup({ title, options, value, onChange, emptyText }) {
  return (
    <div className="option-group">
      <h3>{title}</h3>
      <div className="option-list">
        {options.length === 0 ? <span className="option-empty">{emptyText}</span> : null}
        {options.map((option, index) => (
          <button
            key={`${option}-${index}`}
            type="button"
            className={`option-chip ${value === option ? 'active' : ''}`}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function WordListEditor({
  words,
  title,
  placeholder,
  addLabel,
  onAdd,
  onChange,
  onRemove
}) {
  return (
    <div className="teacher-word-panel">
      <p className="teacher-tip">留空内容不会展示在儿童端。</p>
      <div className="teacher-word-list">
        {words.map((word, index) => (
          <div className="teacher-word-row" key={`${title}-${index}`}>
            <input
              type="text"
              className="teacher-word-input"
              value={word}
              placeholder={placeholder}
              onChange={(event) => onChange(index, event.target.value)}
            />
            <button
              type="button"
              className="teacher-delete-btn"
              onClick={() => onRemove(index)}
            >
              删除
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="teacher-add-btn" onClick={onAdd}>
        {addLabel}
      </button>
    </div>
  );
}

export default function App() {
  const addFilesInputRef = useRef(null);
  const [teacherConfig, setTeacherConfig] = useState(loadTeacherConfig);
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [teacherTab, setTeacherTab] = useState('items');

  const [selectedPronoun, setSelectedPronoun] = useState(defaultPronouns[0] || '');
  const [selectedVerb, setSelectedVerb] = useState(defaultVerbs[0] || '');
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [sentence, setSentence] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copyTip, setCopyTip] = useState('');

  const availablePronouns = useMemo(
    () => teacherConfig.pronouns.map((word) => word.trim()).filter(Boolean),
    [teacherConfig.pronouns]
  );

  const availableVerbs = useMemo(
    () => teacherConfig.verbs.map((word) => word.trim()).filter(Boolean),
    [teacherConfig.verbs]
  );

  const selectedItems = useMemo(
    () => teacherConfig.items.filter((item) => selectedItemIds.includes(item.id)),
    [selectedItemIds, teacherConfig.items]
  );

  const selectedNames = selectedItems.map((item) => item.name || '未命名物品');
  const canGenerate = Boolean(selectedPronoun && selectedVerb && selectedItemIds.length > 0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(TEACHER_STORAGE_KEY, JSON.stringify(teacherConfig));
    } catch (_err) {
      // 忽略存储异常，避免影响主流程
    }
  }, [teacherConfig]);

  useEffect(() => {
    setSelectedItemIds((prev) =>
      prev.filter((id) => teacherConfig.items.some((item) => item.id === id))
    );
  }, [teacherConfig.items]);

  useEffect(() => {
    if (availablePronouns.length === 0) {
      if (selectedPronoun !== '') {
        setSelectedPronoun('');
      }
      return;
    }

    if (!availablePronouns.includes(selectedPronoun)) {
      setSelectedPronoun(availablePronouns[0]);
    }
  }, [availablePronouns, selectedPronoun]);

  useEffect(() => {
    if (availableVerbs.length === 0) {
      if (selectedVerb !== '') {
        setSelectedVerb('');
      }
      return;
    }

    if (!availableVerbs.includes(selectedVerb)) {
      setSelectedVerb(availableVerbs[0]);
    }
  }, [availableVerbs, selectedVerb]);

  function updateItems(updater) {
    setTeacherConfig((prev) => ({
      ...prev,
      items: updater(prev.items)
    }));
  }

  function updateWords(key, updater) {
    setTeacherConfig((prev) => ({
      ...prev,
      [key]: updater(prev[key])
    }));
  }

  function toggleItem(id) {
    setSentence('');
    setError('');
    setCopyTip('');

    setSelectedItemIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((itemId) => itemId !== id);
      }
      return [...prev, id];
    });
  }

  async function handleGenerate() {
    setError('');
    setSentence('');
    setCopyTip('');

    if (!selectedPronoun || !selectedVerb) {
      setError('请先在老师端配置至少 1 个“人称”和 1 个“动词”。');
      return;
    }

    if (selectedItemIds.length === 0) {
      setError('请先选择至少一张图片。');
      return;
    }

    try {
      setIsLoading(true);
      const text = await generateSentenceWithQwen({
        pronoun: selectedPronoun,
        verb: selectedVerb,
        itemNames: selectedNames
      });
      setSentence(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请稍后再试。');
    } finally {
      setIsLoading(false);
    }
  }

  function clearSelection() {
    setSelectedPronoun(availablePronouns[0] || '');
    setSelectedVerb(availableVerbs[0] || '');
    setSelectedItemIds([]);
    setSentence('');
    setError('');
    setCopyTip('');
  }

  async function handleCopy() {
    if (!sentence) {
      setError('当前没有可复制的句子，请先生成。');
      return;
    }

    try {
      setError('');
      await navigator.clipboard.writeText(sentence);
      setCopyTip('已复制');
    } catch (_err) {
      setError('复制失败，请手动复制。');
    }
  }

  function updateItemField(id, field, value) {
    updateItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function removeItem(id) {
    updateItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function addItemsFromFiles(files) {
    if (!files.length) {
      return;
    }

    try {
      setError('');
      const loadedItems = await Promise.all(
        files.map(async (file) => ({
          image: await readFileAsDataUrl(file),
          name: getNameFromFileName(file.name),
          category: '未分类'
        }))
      );

      updateItems((prev) => {
        let nextId = prev.reduce((maxId, item) => Math.max(maxId, item.id), -1) + 1;
        const appended = loadedItems.map((item) => ({
          id: nextId++,
          ...item
        }));

        return [...prev, ...appended];
      });
    } catch (_err) {
      setError('读取图片失败，请重试。');
    }
  }

  function handleAddItemsFilesChange(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    void addItemsFromFiles(files);
  }

  async function replaceItemImageFromFile(itemId, file) {
    if (!file) {
      return;
    }

    try {
      setError('');
      const image = await readFileAsDataUrl(file);

      updateItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) {
            return item;
          }

          return {
            ...item,
            image,
            name: item.name.trim() ? item.name : getNameFromFileName(file.name)
          };
        })
      );
    } catch (_err) {
      setError('读取图片失败，请重试。');
    }
  }

  function handleReplaceItemFileChange(itemId, event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    void replaceItemImageFromFile(itemId, file);
  }

  function addPronoun() {
    updateWords('pronouns', (prev) => [...prev, '']);
  }

  function updatePronoun(index, value) {
    updateWords('pronouns', (prev) => prev.map((word, idx) => (idx === index ? value : word)));
  }

  function removePronoun(index) {
    updateWords('pronouns', (prev) => prev.filter((_, idx) => idx !== index));
  }

  function addVerb() {
    updateWords('verbs', (prev) => [...prev, '']);
  }

  function updateVerb(index, value) {
    updateWords('verbs', (prev) => prev.map((word, idx) => (idx === index ? value : word)));
  }

  function removeVerb(index) {
    updateWords('verbs', (prev) => prev.filter((_, idx) => idx !== index));
  }

  function resetTeacherConfig() {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('确认恢复默认配置吗？');
      if (!confirmed) {
        return;
      }
    }

    setTeacherConfig(createDefaultConfig());
    setSelectedItemIds([]);
    setSentence('');
    setError('');
    setCopyTip('');
  }

  return (
    <div className="app-shell">
      <div className="floating floating-a" />
      <div className="floating floating-b" />
      <div className="floating floating-c" />

      <main className="main-wrap">
        <header className="hero">
          <p className="eyebrow">儿童表达辅助</p>
          <h1>点一点，帮我说一句话</h1>
          <p className="hero-tip">先选图片，再选“人称 + 动词”，最后点击生成。</p>
          <div className="teacher-entry-wrap">
            <button
              type="button"
              className="teacher-entry-btn"
              onClick={() => setTeacherOpen((prev) => !prev)}
            >
              {teacherOpen ? '关闭老师端' : '老师端入口'}
            </button>
          </div>
        </header>

        {teacherOpen ? (
          <section className="panel teacher-panel">
            <div className="teacher-head">
              <h2>老师端设置</h2>
              <p>可修改图片数量/名称/分类，以及人称和动词。改动会自动保存在当前浏览器。</p>
            </div>

            <div className="teacher-tabs">
              <button
                type="button"
                className={`teacher-tab ${teacherTab === 'items' ? 'active' : ''}`}
                onClick={() => setTeacherTab('items')}
              >
                图片管理
              </button>
              <button
                type="button"
                className={`teacher-tab ${teacherTab === 'pronouns' ? 'active' : ''}`}
                onClick={() => setTeacherTab('pronouns')}
              >
                人称管理
              </button>
              <button
                type="button"
                className={`teacher-tab ${teacherTab === 'verbs' ? 'active' : ''}`}
                onClick={() => setTeacherTab('verbs')}
              >
                动词管理
              </button>
            </div>

            {teacherTab === 'items' ? (
              <div className="teacher-panel-content">
                <div className="teacher-toolbar">
                  <strong>当前图片数量：{teacherConfig.items.length}</strong>
                  <button
                    type="button"
                    className="teacher-add-btn"
                    onClick={() => addFilesInputRef.current?.click()}
                  >
                    从文件增加图片
                  </button>
                  <input
                    ref={addFilesInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="teacher-hidden-file"
                    onChange={handleAddItemsFilesChange}
                  />
                </div>

                <div className="teacher-items-list">
                  {teacherConfig.items.map((item) => (
                    <div key={item.id} className="teacher-item-card">
                      <div className="teacher-item-preview">
                        <img src={item.image} alt={item.name || '图片预览'} loading="lazy" />
                      </div>

                      <label className="teacher-field">
                        名称
                        <input
                          type="text"
                          value={item.name}
                          placeholder="例如：苹果"
                          onChange={(event) =>
                            updateItemField(item.id, 'name', event.target.value)
                          }
                        />
                      </label>

                      <label className="teacher-field">
                        分类
                        <input
                          type="text"
                          value={item.category}
                          placeholder="例如：水果"
                          onChange={(event) =>
                            updateItemField(item.id, 'category', event.target.value)
                          }
                        />
                      </label>

                      <div className="teacher-item-actions">
                        <label className="teacher-file-btn">
                          选择图片
                          <input
                            type="file"
                            accept="image/*"
                            className="teacher-hidden-file"
                            onChange={(event) => handleReplaceItemFileChange(item.id, event)}
                          />
                        </label>

                        <button
                          type="button"
                          className="teacher-delete-btn"
                          onClick={() => removeItem(item.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {teacherTab === 'pronouns' ? (
              <div className="teacher-panel-content">
                <WordListEditor
                  title="pronouns"
                  words={teacherConfig.pronouns}
                  placeholder="例如：我"
                  addLabel="新增人称"
                  onAdd={addPronoun}
                  onChange={updatePronoun}
                  onRemove={removePronoun}
                />
              </div>
            ) : null}

            {teacherTab === 'verbs' ? (
              <div className="teacher-panel-content">
                <WordListEditor
                  title="verbs"
                  words={teacherConfig.verbs}
                  placeholder="例如：喜欢"
                  addLabel="新增动词"
                  onAdd={addVerb}
                  onChange={updateVerb}
                  onRemove={removeVerb}
                />
              </div>
            ) : null}

            <div className="teacher-footer">
              <button type="button" className="teacher-reset-btn" onClick={resetTeacherConfig}>
                恢复默认配置
              </button>
            </div>
          </section>
        ) : null}

        <section className="panel">
          <div className="panel-head">
            <h2>1. 选择图片</h2>
            <p>可以多选，系统会用你选的内容生成句子。</p>
          </div>

          <div className="items-grid">
            {teacherConfig.items.map((item, index) => {
              const active = selectedItemIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`item-card ${active ? 'active' : ''}`}
                  onClick={() => toggleItem(item.id)}
                  style={{ '--delay': `${index * 0.04}s` }}
                >
                  <img src={item.image} alt={item.name || '未命名'} loading="lazy" />
                  <div className="item-meta">
                    <span className="item-name">{item.name || '未命名'}</span>
                    <span className="item-tag">{item.category || '未分类'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel panel-options">
          <div className="option-wrap">
            <OptionGroup
              title="2. 选择人称"
              options={availablePronouns}
              value={selectedPronoun}
              onChange={setSelectedPronoun}
              emptyText="请先在老师端添加人称"
            />
            <OptionGroup
              title="3. 选择动词"
              options={availableVerbs}
              value={selectedVerb}
              onChange={setSelectedVerb}
              emptyText="请先在老师端添加动词"
            />
          </div>

          <div className="selection-preview">
            <span>当前组合：</span>
            <strong>
              {selectedPronoun && selectedVerb
                ? `${selectedPronoun}${selectedVerb}${
                    selectedNames.length > 0 ? selectedNames.join('、') : '（请先选图片）'
                  }`
                : '（请先在老师端设置人称和动词）'}
            </strong>
          </div>

          <div className="action-row">
            <button
              type="button"
              className="btn-generate"
              onClick={handleGenerate}
              disabled={isLoading || !canGenerate}
            >
              {isLoading ? '正在生成...' : '生成一句话'}
            </button>
            <button type="button" className="btn-clear" onClick={clearSelection}>
              清空重选
            </button>
          </div>

          <div className="result-box">
            <div className="result-content" aria-live="polite">
              {error ? <p className="error-text">{error}</p> : null}
              {!error && sentence ? <p className="sentence">{sentence}</p> : null}
              {!error && !sentence ? (
                <p className="placeholder">生成结果会显示在这里。</p>
              ) : null}
            </div>

            <div className="result-actions">
              <button
                type="button"
                className="btn-result btn-copy"
                onClick={handleCopy}
                disabled={!sentence}
              >
                {copyTip || '一键复制'}
              </button>
              <button
                type="button"
                className="btn-result btn-refresh"
                onClick={handleGenerate}
                disabled={isLoading || !canGenerate}
              >
                {isLoading ? '生成中...' : '重新生成'}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
