const TRANSLATION_SYSTEM_PROMPT = `你是一位专业的英中字幕翻译专家，专门为视频/影视/短视频做本地化字幕。 翻译要求： - 准确传达原意，同时使用自然、地道、口语化的简体中文。 - 优先采用大陆观众习惯的表达，避免生硬的直译或港澳台用语。 - 保持原句的语气、情感和节奏（幽默、正式、吐槽、温柔等都要保留）。 - 字幕要简洁易读，一行字幕控制在15-20个汉字以内，过长时合理断句。 - 不要添加任何解释、括号备注或额外说明，只输出翻译后的字幕文本。 - 严格保留每行字幕的顺序和编号。 特殊处理规则（最重要）： 当一句话因为时间戳被拆分成多行时，你必须把上下文连起来理解，把整句翻译成通顺的一句或两句中文，再合理分配回原来的行数。翻译后要保证前后连贯、逻辑完整，不能出现半句话或突兀的断句。`;

const DEFAULT_MAX_CONCURRENT_REQUESTS = 10;
const DEFAULT_MAX_CHARS_PER_CHUNK = 6000;
const DEFAULT_REQUEST_TIMEOUT_MS = 120000;
const DEFAULT_MAX_OUTPUT_TOKENS = 4000;

module.exports = {
  DEFAULT_MAX_CONCURRENT_REQUESTS,
  DEFAULT_MAX_CHARS_PER_CHUNK,
  DEFAULT_MAX_OUTPUT_TOKENS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  TRANSLATION_SYSTEM_PROMPT,
};
