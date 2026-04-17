# image_to_pdf

将截图文件夹中的图片先做无损优化，再按文件名自然顺序合并为 PDF。

## 安装

```bash
cd /Users/mqy/project/video_learn_helper/image_to_pdf
npm install
```

## 用法

```bash
node index.js <图片文件夹路径> [输出PDF路径]
```

示例：

```bash
node index.js "/path/to/screenshots" "/path/to/output/course-notes.pdf"
```

如果不传输出路径，脚本会在输入文件夹内部生成一个同名 PDF，例如：

```bash
node index.js "/path/to/screenshots"
```

会输出：

```bash
/path/to/screenshots/screenshots.pdf
```

## 支持格式

`png`、`jpg`、`jpeg`、`webp`、`tif`、`tiff`、`gif`

## 压缩说明

- PNG / WebP / TIFF / GIF 会转成经过无损压缩优化的 PNG 后再写入 PDF。
- JPEG 会保留原始数据直接写入 PDF，避免有损重编码。
