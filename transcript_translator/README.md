# transcript_translator

Node.js command line tool for translating subtitle files into Simplified Chinese with LLM APIs.

## Features

- Supports `.srt` and `.vtt`
- Saves translated output beside the source file as `filename.cn.ext`
- Splits large subtitle files into multiple API requests
- Defaults to DeepSeek API, with a provider abstraction for future expansion

## Usage

```bash
cd /Users/mqy/project/video_learn_helper/transcript_translator
cat > .env <<'EOF'
DEEPSEEK_API_KEY=your_key
DEEPSEEK_MODEL=deepseek-chat
EOF

node index.js /absolute/path/to/subtitle.srt
```

Use `deepseek-reasoner` explicitly:

```bash
node index.js /absolute/path/to/subtitle.srt --model deepseek-reasoner
```

## Options

```bash
node index.js <subtitle-file> \
  --provider deepseek \
  --model deepseek-chat \
  --max-chars-per-chunk 6000 \
  --concurrency 10 \
  --timeout-ms 120000
```

## Environment Variables

- The CLI automatically loads [`.env`](/Users/mqy/project/video_learn_helper/transcript_translator/.env) from the `transcript_translator` directory
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `TRANSLATOR_PROVIDER`
- `TRANSLATOR_CONCURRENCY`
- `LLM_PROVIDER`
- `LLM_API_KEY`
- `LLM_CONCURRENCY`

## Extend to More APIs

Add a new provider definition in [src/providers/index.js](/Users/mqy/project/video_learn_helper/transcript_translator/src/providers/index.js) and reuse the OpenAI-compatible client in [src/providers/openai-compatible.js](/Users/mqy/project/video_learn_helper/transcript_translator/src/providers/openai-compatible.js).
