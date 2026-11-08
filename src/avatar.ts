const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const OUTPUT_SIZE = 256;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("无法读取这张图片，请换一张 JPG/PNG。"));
    image.src = url;
  });
}

export async function imageFileToAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件。");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("图片太大了，请选择 10MB 以内的图片。");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new Error("图片尺寸无效。");

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法处理图片。");

    context.fillStyle = "#eef9f1";
    context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    const sx = (image.naturalWidth - side) / 2;
    const sy = (image.naturalHeight - side) / 2;
    context.drawImage(
      image,
      sx,
      sy,
      side,
      side,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    );
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
