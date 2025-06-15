import { createCanvas, loadImage } from 'canvas';

export async function renderTemplateDetail(data) {
  // 基础尺寸设置
  const scale = 2; // 2倍缩放提高清晰度
  const width = 800;
  
  // 计算基础高度（不包含内容区域）
  const baseHeight = 350; // 基础信息区域的高度
  
  // 动态计算高度
  let dynamicHeight = baseHeight;
  
  // 根据模板类型计算高度
  if (data.template.type === '按钮') {
    try {
      let buttonData = null;
      try {
        buttonData = JSON.parse(data.template.content);
      } catch (e) {
        console.error('按钮模板内容解析失败:', e);
      }
      
      if (buttonData && buttonData.rows) {
        // 计算按钮行数，每行45px高度，最大显示5行
        const rowCount = Math.min(buttonData.rows.length, 5);
        // 增加底部边距，确保最后一行按钮完全在内边框内
        const buttonAreaHeight = rowCount * 45 + 150; // 每行45px + 更大的上下边距
        dynamicHeight = baseHeight + buttonAreaHeight;
      }
    } catch (e) {
      console.error('计算按钮高度失败:', e);
    }
  } else if (data.template.type === 'Markdown') {
    // Markdown模板需要更多空间显示内容
    const contentLength = data.template.content ? data.template.content.length : 0;
    // 根据内容长度估算所需高度，确保有足够空间显示所有内容
    const estimatedHeight = Math.max(300, Math.ceil(contentLength / 2));
    dynamicHeight = baseHeight + estimatedHeight;
  }
  
  // 确保最小高度
  dynamicHeight = Math.max(dynamicHeight, 600);
  
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

  // 绘制容器背景（外边框）
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

  // 根据模板类型渲染不同的内容
  if (data.template.type === '按钮') {
    renderButtonTemplate(ctx, data.template.content, width, y, dynamicHeight);
  } else if (data.template.type === 'Markdown') {
    renderMarkdownTemplate(ctx, data.template.content, width, y, dynamicHeight);
  } else {
    // 其他类型模板，直接显示内容文本
    ctx.fillStyle = '#333';
    ctx.font = '16px 微软雅黑';
    wrapText(ctx, data.template.content || '无内容', 50, y + 85, width - 100, 24);
  }

  return canvas.toBuffer('image/png', { quality: 1, compressionLevel: 0 });
}

// 渲染按钮模板
function renderButtonTemplate(ctx, content, width, startY, totalHeight) {
  try {
    // 尝试解析JSON内容
    let buttonData = null;
    try {
      buttonData = JSON.parse(content);
    } catch (e) {
      console.error('按钮模板内容解析失败:', e);
      // 解析失败，显示原始内容
      ctx.fillStyle = '#333';
      ctx.font = '16px 微软雅黑';
      wrapText(ctx, content || '无内容', 50, startY + 85, width - 100, 24);
      return;
    }

    if (buttonData && buttonData.rows) {
      // 计算需要显示的行数
      const rowCount = Math.min(buttonData.rows.length, 5); // 最多显示5行
      
      // 计算内边框的高度
      const contentPadding = 30; // 内边框与外边框的间距
      const rowHeight = 45; // 按钮行高度
      
      // 根据按钮行数计算内容区域的高度
      const contentAreaHeight = (rowCount * rowHeight) + (contentPadding * 2);
      
      // 确保内容区域不会超出画布
      const contentTop = startY + 60;
      const maxContentHeight = totalHeight - contentTop - 60;
      const finalContentHeight = Math.min(contentAreaHeight, maxContentHeight);
      
      // 绘制按钮预览背景（内边框）
      ctx.fillStyle = '#f0f0f0';
      roundRect(ctx, 40, contentTop, width - 80, finalContentHeight, 12);
      ctx.fill();

      // 计算按钮区域
      const buttonAreaTop = contentTop + contentPadding;
      const buttonAreaWidth = width - 80 - (contentPadding * 2);
      let buttonY = buttonAreaTop;
      const buttonSpacing = 4; // 按钮间距

      // 遍历每一行按钮
      buttonData.rows.forEach((row, rowIndex) => {
        if (rowIndex >= rowCount) return; // 最多显示5行
        
        const buttons = row.buttons || [];
        if (buttons.length === 0) return;
        
        // 计算当前行按钮数量和宽度
        const buttonCount = Math.min(buttons.length, 10); // 每行最多显示10个按钮
        const buttonWidth = (buttonAreaWidth - (buttonCount - 1) * buttonSpacing) / buttonCount;
        
        // 绘制当前行的所有按钮
        buttons.forEach((button, buttonIndex) => {
          if (buttonIndex >= buttonCount) return;
          
          const x = 40 + contentPadding + buttonIndex * (buttonWidth + buttonSpacing);
          const style = button.render_data?.style || 0;
          
          // 绘制按钮
          drawButton(ctx, x, buttonY, buttonWidth, 36, style, button.render_data?.label || '按钮');
        });
        
        buttonY += rowHeight;
      });
    } else {
      // 无有效按钮数据
      ctx.fillStyle = '#333';
      ctx.font = '16px 微软雅黑';
      ctx.fillText('未找到有效的按钮数据', 60, startY + 100);
    }
  } catch (e) {
    console.error('渲染按钮模板失败:', e);
    // 如果渲染失败，回退到显示原始内容
    ctx.fillStyle = '#333';
    ctx.font = '16px 微软雅黑';
    wrapText(ctx, content || '无内容', 50, startY + 85, width - 100, 24);
  }
}

// 渲染Markdown模板
function renderMarkdownTemplate(ctx, content, width, startY, totalHeight) {
  // 为Markdown内容创建一个滚动区域
  const contentPadding = 30; // 增加内边框与外边框的间距
  const contentTop = startY + 60;
  const contentBottom = totalHeight - 80;
  const contentHeight = contentBottom - contentTop;
  
  ctx.fillStyle = '#f9f9f9';
  roundRect(ctx, 40, contentTop, width - 80, contentHeight, 12);
  ctx.fill();
  
  // 绘制Markdown内容
  ctx.fillStyle = '#333';
  ctx.font = '16px 微软雅黑';
  
  // 使用更小的行高以显示更多内容
  const lineHeight = 22;
  
  // 简单处理一些Markdown语法
  const lines = (content || '无内容').split('\n');
  let y = contentTop + contentPadding;
  
  for (const line of lines) {
    let processedLine = line.trim();
    let x = 60;
    
    // 简单处理Markdown标题
    if (processedLine.startsWith('# ')) {
      ctx.font = 'bold 20px 微软雅黑';
      processedLine = processedLine.substring(2);
    } else if (processedLine.startsWith('## ')) {
      ctx.font = 'bold 18px 微软雅黑';
      processedLine = processedLine.substring(3);
    } else if (processedLine.startsWith('### ')) {
      ctx.font = 'bold 16px 微软雅黑';
      processedLine = processedLine.substring(4);
    } else if (processedLine.startsWith('- ')) {
      // 简单处理列表
      processedLine = '• ' + processedLine.substring(2);
      x += 10; // 缩进列表项
    } else {
      ctx.font = '16px 微软雅黑';
    }
    
    // 处理粗体
    if (processedLine.includes('**')) {
      // 这里简化处理，实际上需要更复杂的解析
      ctx.font = 'bold 16px 微软雅黑';
      processedLine = processedLine.replace(/\*\*/g, '');
    }
    
    // 绘制当前行
    wrapTextWithX(ctx, processedLine, x, y, width - 120, lineHeight);
    
    // 更新Y坐标
    const metrics = ctx.measureText(processedLine);
    const wrappedLines = Math.ceil(metrics.width / (width - 120));
    y += lineHeight * Math.max(1, wrappedLines);
    
    // 如果已经超出内容区域，动态增加画布高度
    if (y + lineHeight > contentBottom - contentPadding) {
      // 这里我们不做任何限制，让内容完全显示
      // 实际应用中可能需要考虑性能问题
    }
  }
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

// 辅助函数：带X坐标的文本换行
function wrapTextWithX(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split('');
  let line = '';
  const startX = x;
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n];
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n];
      currentY += lineHeight;
      x = startX; // 换行后重置X坐标
    } else {
      line = testLine;
    }
  }
  
  ctx.fillText(line, x, currentY);
  return currentY + lineHeight; // 返回下一行的Y坐标
} 