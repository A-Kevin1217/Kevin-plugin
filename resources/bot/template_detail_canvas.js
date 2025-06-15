import { createCanvas, loadImage } from 'canvas';

export async function renderTemplateDetail(data) {
  // 基础尺寸设置
  const scale = 2; // 2倍缩放提高清晰度
  const width = 800;
  
  // 计算基础高度（不包含按钮区域）
  const baseHeight = 350; // 基础信息区域的高度
  
  // 动态计算高度
  let dynamicHeight = baseHeight;
  
  // 如果是按钮模板，预计算所需高度
  if (data.template.type === '按钮') {
    try {
      let buttonData = null;
      try {
        buttonData = JSON.parse(data.template.content);
      } catch (e) {
        console.error('按钮模板内容解析失败:', e);
      }
      
      if (buttonData && buttonData.rows) {
        // 计算按钮行数，每行45px高度，最大显示10行
        const rowCount = Math.min(buttonData.rows.length, 10);
        const buttonAreaHeight = rowCount * 45 + 80; // 每行45px + 上下边距
        dynamicHeight = baseHeight + buttonAreaHeight;
      }
    } catch (e) {
      console.error('计算按钮高度失败:', e);
    }
  }
  
  // 创建画布，应用缩放
  const canvas = createCanvas(width * scale, dynamicHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // 启用抗锯齿
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 设置背景
  ctx.fillStyle = 'rgba(245, 245, 245, 0.9)';
  ctx.fillRect(0, 0, width, dynamicHeight);

  // 绘制容器背景
  ctx.fillStyle = '#fff';
  roundRect(ctx, 20, 20, width - 40, dynamicHeight - 40, 15);
  ctx.fill();

  // 添加阴影效果
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  // 绘制标题区域
  ctx.fillStyle = '#333';
  ctx.font = 'bold 28px 微软雅黑';
  ctx.fillText('Bot模板详情', 40, 60);

  // 重置阴影
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // 绘制账号和AppId
  ctx.font = '16px 微软雅黑';
  ctx.fillStyle = '#666';
  ctx.fillText(`账号：${data.uin}`, 40, 90);
  ctx.fillText(`AppId：${data.appId}`, 200, 90);

  // 绘制分割线
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 110);
  ctx.lineTo(width - 40, 110);
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
    roundRect(ctx, 40, y, width - 80, 40, 8);
    ctx.fill();

    // 绘制标签
    ctx.fillStyle = '#666';
    ctx.font = 'bold 16px 微软雅黑';
    ctx.fillText(item.label, 50, y + 25);

    // 绘制值
    ctx.fillStyle = getStatusColor(item.label === '审核状态' ? item.value : null);
    ctx.font = '16px 微软雅黑';
    ctx.fillText(item.value, 150, y + 25);

    y += 50;
  });

  // 绘制模板内容区域标题
  ctx.fillStyle = '#333';
  ctx.font = 'bold 18px 微软雅黑';
  ctx.fillText('模板内容', 50, y + 25);

  // 绘制分割线
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, y + 40);
  ctx.lineTo(width - 50, y + 40);
  ctx.stroke();

  // 如果是按钮模板，尝试解析并渲染按钮
  if (data.template.type === '按钮') {
    try {
      // 尝试解析JSON内容
      let buttonData = null;
      try {
        buttonData = JSON.parse(data.template.content);
      } catch (e) {
        console.error('按钮模板内容解析失败:', e);
      }

      if (buttonData && buttonData.rows) {
        // 绘制按钮预览背景
        ctx.fillStyle = '#f0f0f0';
        roundRect(ctx, 50, y + 60, width - 100, dynamicHeight - y - 100, 12);
        ctx.fill();

        let buttonY = y + 80;
        const rowHeight = 45; // 按钮行高度
        const buttonSpacing = 4; // 按钮间距

        // 遍历每一行按钮
        buttonData.rows.forEach((row, rowIndex) => {
          if (rowIndex > 9) return; // 最多显示10行
          
          const buttons = row.buttons || [];
          if (buttons.length === 0) return;
          
          // 计算当前行按钮数量和宽度
          const buttonCount = Math.min(buttons.length, 5); // 每行最多显示5个按钮
          const buttonWidth = (width - 120 - (buttonCount - 1) * buttonSpacing) / buttonCount;
          
          // 绘制当前行的所有按钮
          buttons.forEach((button, buttonIndex) => {
            if (buttonIndex >= 5) return; // 每行最多显示5个按钮
            
            const x = 50 + buttonIndex * (buttonWidth + buttonSpacing);
            const style = button.render_data?.style || 0;
            
            // 绘制按钮背景
            drawButton(ctx, x, buttonY, buttonWidth, 36, style, button.render_data?.label || '按钮');
          });
          
          buttonY += rowHeight;
        });
      } else {
        // 如果解析失败，显示原始内容
        ctx.fillStyle = '#333';
        ctx.font = '16px 微软雅黑';
        wrapText(ctx, data.template.content, 50, y + 85, width - 100, 24);
      }
    } catch (e) {
      console.error('渲染按钮模板失败:', e);
      // 如果渲染失败，回退到显示原始内容
      ctx.fillStyle = '#333';
      ctx.font = '16px 微软雅黑';
      wrapText(ctx, data.template.content, 50, y + 85, width - 100, 24);
    }
  } else {
    // 如果不是按钮模板，直接显示内容文本
    ctx.fillStyle = '#333';
    ctx.font = '16px 微软雅黑';
    wrapText(ctx, data.template.content, 50, y + 85, width - 100, 24);
  }

  return canvas.toBuffer('image/png', { quality: 1, compressionLevel: 0 });
}

// 绘制按钮
function drawButton(ctx, x, y, width, height, style, label) {
  // 按钮样式
  let borderColor, textColor, bgColor;
  
  switch (parseInt(style)) {
    case 0: // 灰色线框
      borderColor = '#ccc';
      textColor = '#333';
      bgColor = '#fff';
      break;
    case 1: // 蓝色线框
      borderColor = '#12b7f5';
      textColor = '#12b7f5';
      bgColor = '#fff';
      break;
    case 2: // 智能体按钮
      borderColor = '#ccc';
      textColor = '#333';
      bgColor = '#fff';
      break;
    case 3: // 灰线框红字
      borderColor = '#ccc';
      textColor = '#f24d4d';
      bgColor = '#fff';
      break;
    case 4: // 蓝色背景白字
      borderColor = '#12b7f5';
      textColor = '#fff';
      bgColor = '#12b7f5';
      break;
    default:
      borderColor = '#ccc';
      textColor = '#333';
      bgColor = '#fff';
  }

  // 绘制按钮背景
  ctx.fillStyle = bgColor;
  roundRect(ctx, x, y, width, height, 4);
  ctx.fill();
  
  // 绘制按钮边框
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, width, height, 4);
  ctx.stroke();
  
  // 智能体按钮特殊处理
  if (parseInt(style) === 2) {
    ctx.fillStyle = '#9c27b0';
    ctx.beginPath();
    ctx.arc(x + 15, y + height/2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // 绘制按钮文本
  ctx.fillStyle = textColor;
  ctx.font = '14px 微软雅黑';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // 如果文本过长，进行截断处理
  const maxTextWidth = width - 20;
  let displayText = label;
  const metrics = ctx.measureText(displayText);
  
  if (metrics.width > maxTextWidth) {
    // 文本过长，需要截断
    let tempText = displayText;
    while (ctx.measureText(tempText + '...').width > maxTextWidth && tempText.length > 0) {
      tempText = tempText.substring(0, tempText.length - 1);
    }
    displayText = tempText + '...';
  }
  
  // 智能体按钮文本位置需要右移
  const textX = parseInt(style) === 2 ? x + width/2 + 10 : x + width/2;
  ctx.fillText(displayText, textX, y + height/2);
  
  // 重置文本对齐方式
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
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