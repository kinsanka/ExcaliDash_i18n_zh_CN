const textReplacements = new Map<string, string>([
  ["Cut", "剪切"],
  ["Copy", "复制"],
  ["Paste", "粘贴"],
  ["Delete", "删除"],
  ["Duplicate", "复制"],
  ["Select all", "全部选中"],
  ["Group selection", "编组"],
  ["Ungroup selection", "取消编组"],
  ["Add to library", "添加到素材库中"],
  ["Copy styles", "拷贝样式"],
  ["Paste styles", "粘贴样式"],
  ["Bring forward", "上移一层"],
  ["Send backward", "下移一层"],
  ["Bring to front", "置于顶层"],
  ["Send to back", "置于底层"],
  ["Flip horizontal", "水平翻转"],
  ["Flip vertical", "垂直翻转"],
  ["Unbind text", "取消文本绑定"],
  ["Bind text to the container", "将文本绑定到容器"],
  ["Wrap text in a container", "将文本包围在容器中"],
  ["Enable text auto-resizing", "启用文本自动调整大小"],
  ["Crop image", "裁剪图片"],
  ["Finish image cropping", "完成图片裁剪"],
  ["Image cropping", "图片裁剪"],
  ["Add link", "新建链接"],
  ["Edit link", "编辑链接"],
  ["Edit line", "编辑线条"],
  ["Edit arrow", "编辑箭头"],
  ["Link to object", "对象链接"],
  ["Lock", "锁定"],
  ["Unlock", "解锁"],
  ["Find on canvas", "在画布中查找"],
  ["Excalidraw links", "Excalidraw 链接"],
  ["Follow us", "关注我们"],
  ["Discord chat", "Discord 聊天"],
  ["Toggle grid", "切换网格"],
  ["Canvas & Shape properties", "画布和图形属性"],
  ["Canvas", "画布"],
  ["Grid step", "网格步长"],
  ["General", "常规"],
  ["Shape properties", "图形属性"],
  ["Shapes", "图形"],
  ["Mixed", "混合"],
  ["Width", "宽度"],
  ["Height", "高度"],
  ["Angle", "角度"],
  ["Scene", "画布"],
  ["Selected", "选中"],
  ["Properties", "属性"],
  ["Version", "版本"],
  ["Total", "总计"],
  ["Arrow type", "箭头类型"],
  ["Sharp arrow", "直角箭头"],
  ["Curved arrow", "曲线箭头"],
  ["Elbow arrow", "折线箭头"],
  ["Arrowheads", "箭头端点"],
  ["More options", "更多选项"],
  ["Opacity", "透明度"],
  ["Command palette", "命令面板"],
  ["Show font picker", "显示字体选择器"],
  ["Paste as plaintext", "粘贴为纯文本"],
  ["Create a flowchart from a generic element", "从通用元素创建流程图"],
  ["Navigate a flowchart", "导航流程图"],
  ["Type or paste your link here", "在这里输入或粘贴链接"],
  ["Empty Web-Embed", "空网页嵌入"],
  [
    "Click on a shape on canvas or paste a link.",
    "点击画布上的图形，或粘贴一个链接。",
  ],
  [
    "Press Enter to add text. Hold Ctrl and Arrow key to create a flowchart",
    "按下 Enter 添加文本。按住 Ctrl 和方向键可创建流程图",
  ],
  ["Failed to save changes", "保存更改失败"],
  [
    "Click to start multiple points, drag for single line. Press A again to change arrow type.",
    "单击开始绘制多个点，拖动可绘制单条线段。再次按 A 可切换箭头类型。",
  ],
  [
    "Click to start multiple points, drag for single arrow. Press A again to change arrow type.",
    "单击开始绘制多个点，拖动可绘制单个箭头。再次按 A 可切换箭头类型。",
  ],
  ["None", "无"],
  ["Arrow", "箭头"],
  ["Bar", "横杠"],
  ["Circle", "圆形"],
  ["Circle (outline)", "空心圆"],
  ["Triangle", "三角形"],
  ["Triangle (outline)", "空心三角"],
  ["Diamond", "菱形"],
  ["Diamond (outline)", "空心菱形"],
  ["Crow's foot (one)", "乌鸦脚（单）"],
  ["Crow's foot (many)", "乌鸦脚（多）"],
  ["Crow's foot (one or many)", "乌鸦脚（单或多）"],
  ["rectangle", "矩形"],
  ["diamond", "菱形"],
  ["ellipse", "椭圆"],
  ["arrow", "箭头"],
  ["line", "线条"],
  ["freedraw", "自由绘制"],
  ["selection", "选择"],
  ["text", "文本"],
  ["library", "素材库"],
  ["lock", "锁定"],
  ["image", "图片"],
  ["frame", "画框"],
  ["eraser", "橡皮擦"],
  ["hand", "抓手"],
  ["Generate", "生成"],
  ["Wrap selection in frame", "将选区放入画框"],
  ["Copy link to object", "复制对象链接"],
]);

const normalizeText = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\u2026/g, "...")
    .trim();

const getReplacement = (value: string) => {
  const normalizedValue = normalizeText(value);
  for (const [source, target] of textReplacements) {
    if (normalizeText(source) === normalizedValue) {
      return target;
    }
  }
  return null;
};

const escapeForRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceKnownSubstrings = (value: string) => {
  let nextValue = value;
  for (const [source, target] of textReplacements) {
    const pattern = new RegExp(escapeForRegex(source), "g");
    nextValue = nextValue.replace(pattern, target);
  }
  return nextValue;
};

const replaceText = (node: Node) => {
  if (node.nodeType === Node.TEXT_NODE) {
    const rawValue = node.textContent;
    const value = rawValue?.trim();
    const replacement = value ? getReplacement(value) : null;
    if (rawValue && value && replacement) {
      node.textContent = rawValue.replace(value, replacement);
    } else if (rawValue) {
      const replacedValue = replaceKnownSubstrings(rawValue);
      if (replacedValue !== rawValue) {
        node.textContent = replacedValue;
      }
    }
    return;
  }

  if (!(node instanceof HTMLElement)) {
    return;
  }

  const ariaLabel = node.getAttribute("aria-label");
  const ariaLabelReplacement = ariaLabel ? getReplacement(ariaLabel) : null;
  if (ariaLabel && ariaLabelReplacement) {
    node.setAttribute("aria-label", ariaLabelReplacement);
  }

  const title = node.getAttribute("title");
  const titleReplacement = title ? getReplacement(title) : null;
  if (title && titleReplacement) {
    node.setAttribute("title", titleReplacement);
  }

  node.childNodes.forEach(replaceText);
};

export const setupExcalidrawZhCnFallbackTranslations = () => {
  const root = document.body;

  const applyTranslations = () => replaceText(root);
  applyTranslations();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(replaceText);
      if (mutation.type === "characterData" && mutation.target) {
        replaceText(mutation.target);
      }
    }
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  return () => observer.disconnect();
};
