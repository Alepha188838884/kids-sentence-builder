const API_URL =
  import.meta.env.VITE_QWEN_API_URL ||
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

const MODEL = import.meta.env.VITE_QWEN_MODEL || 'qwen-plus';
// 你可以直接把千问 API Key 粘贴到这里，留空则回退到 .env 的 VITE_QWEN_API_KEY。
const MANUAL_QWEN_API_KEY = '';

function resolveApiKey() {
  const manualKey = MANUAL_QWEN_API_KEY.trim();
  if (manualKey) {
    return manualKey;
  }

  return (import.meta.env.VITE_QWEN_API_KEY || '').trim();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSentence(rawContent) {
  const firstLine = (rawContent || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return '';
  }

  return firstLine.replace(/^["'“”‘’「『]+|["'“”‘’」』]+$/g, '').replace(/\s+/g, '');
}

function validateStrictSentence(sentence, pronoun, verb, itemNames) {
  if (!sentence) {
    return '返回为空';
  }

  const itemPart = itemNames.map((name) => escapeRegExp(name)).join('[和与及跟、,，]*');
  const strictPattern = new RegExp(
    `^${escapeRegExp(pronoun)}${escapeRegExp(verb)}${itemPart}[。！？!?]?$`
  );

  if (!strictPattern.test(sentence)) {
    return `句子必须严格由“${pronoun}、${verb}、${itemNames.join('、')}”组成，仅可使用连接词（和/与/及/跟/、/，）和句末标点。`;
  }

  return '';
}

async function requestQwen({ apiKey, messages, temperature = 0.1 }) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      max_tokens: 80,
      messages
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`千问 API 调用失败（${response.status}）：${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('千问返回了空内容，请稍后重试。');
  }

  return content;
}

export async function generateSentenceWithQwen({ pronoun, verb, itemNames }) {
  const apiKey = resolveApiKey();

  if (!apiKey) {
    throw new Error(
      '未检测到 API Key，请先在 src/api/qwen.js 里填写 MANUAL_QWEN_API_KEY，或在 .env 设置 VITE_QWEN_API_KEY。'
    );
  }

  if (!pronoun || !verb || itemNames.length === 0) {
    throw new Error('请先选择人称、动词和至少一个图片。');
  }

  const userPrompt = `
人称：${pronoun}
动词：${verb}
物品：${itemNames.join('、')}

请严格按以下要求造句，不可自由发挥：
1. 句子必须包含且只包含上面给定的人称、动词、全部物品词。
2. 物品之间只允许使用“和/与/及/跟/、/，”作为连接。
3. 禁止新增任何其他名词、动词、形容词、场景描述或礼貌用语。
4. 输出格式必须是：人称 + 动词 + 物品列表，结尾可加句号。
5. 只输出这一句话，不要解释，不要换行。
`.trim();

  const systemPrompt =
    '你是严格语法执行器。你只能按用户给定的人称、动词、物品词输出一句话，不能添加任何额外语义。';

  const firstRaw = await requestQwen({
    apiKey,
    temperature: 0.1,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  });

  let sentence = normalizeSentence(firstRaw);
  let invalidReason = validateStrictSentence(sentence, pronoun, verb, itemNames);
  if (!invalidReason) {
    return sentence;
  }

  const secondRaw = await requestQwen({
    apiKey,
    temperature: 0,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: firstRaw },
      {
        role: 'user',
        content: `你刚才输出不合规，原因：${invalidReason}。请立刻重写，严格遵守规则，只输出一句话。`
      }
    ]
  });

  sentence = normalizeSentence(secondRaw);
  invalidReason = validateStrictSentence(sentence, pronoun, verb, itemNames);
  if (!invalidReason) {
    return sentence;
  }

  throw new Error(`模型输出仍不符合严格规则：${invalidReason} 请点击“重新生成”。`);
}
