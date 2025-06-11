import { createCanvas, loadImage } from 'canvas';

export async function renderTemplateDetail(data) {
  // 创建画布
  const canvas = createCanvas(800, 600);
  const ctx = canvas.getContext('2d');

  // 设置背景
  ctx.fillStyle = 'rgba(245, 245, 245, 0.9)';
  ctx.fillRect(0, 0, 800, 600);

  // 绘制容器背景
  ctx.fillStyle = '#fff';
  roundRect(ctx, 20, 20, 760, 560, 15);
  ctx.fill();

  // 绘制标题区域
  ctx.fillStyle = '#333';
  ctx.font = 'bold 24px 微软雅黑';
  ctx.fillText('Bot模板详情', 40, 60);

  // 绘制账号和AppId
  ctx.font = '14px 微软雅黑';
  ctx.fillStyle = '#666';
  ctx.fillText(`账号：${data.uin}`, 40, 90);
  ctx.fillText(`AppId：${data.appId}`, 200, 90);

  // 绘制分割线
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 110);
  ctx.lineTo(760, 110);
  ctx.stroke();

  // 绘制模板信息
  const infoItems = [
    { label: '模板ID', value: data.template.id },
    { label: '模板名称', value: data.template.name },
    { label: '模板类型', value: data.template.type },
    { label: '审核状态', value: data.template.status }
  ];

  let y = 150;
  infoItems.forEach((item, index) => {
    // 绘制信息项背景
    ctx.fillStyle = '#f9f9f9';
    roundRect(ctx, 40, y, 720, 40, 8);
    ctx.fill();

    // 绘制标签
    ctx.fillStyle = '#666';
    ctx.font = '14px 微软雅黑';
    ctx.fillText(item.label, 50, y + 25);

    // 绘制值
    ctx.fillStyle = getStatusColor(item.label === '审核状态' ? item.value : null);
    ctx.fillText(item.value, 150, y + 25);

    y += 50;
  });

  // 绘制模板内容区域
  ctx.fillStyle = '#f9f9f9';
  roundRect(ctx, 40, y + 20, 720, 200, 8);
  ctx.fill();

  // 绘制内容标题
  ctx.fillStyle = '#333';
  ctx.font = 'bold 16px 微软雅黑';
  ctx.fillText('模板内容', 50, y + 45);

  // 绘制分割线
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, y + 60);
  ctx.lineTo(750, y + 60);
  ctx.stroke();

  // 绘制内容文本
  ctx.fillStyle = '#333';
  ctx.font = '14px 微软雅黑';
  wrapText(ctx, data.template.content, 50, y + 85, 700, 20);

  return canvas.toBuffer();
}

// 辅助函数：绘制圆角矩形
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// 辅助函数：获取状态颜色
function getStatusColor(status) {
  switch (status) {
    case '已通过':
      return '#52c41a';
    case '未通过':
      return '#f5222d';
    case '审核中':
      return '#1890ff';
    case '未提审':
      return '#faad14';
    default:
      return '#333';
  }
}

// 辅助函数：文本换行
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split('');
  let line = '';

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n];
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n];
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
} 