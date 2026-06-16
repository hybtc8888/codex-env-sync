import { request } from 'https';

interface GenerationOptions {
  topic: string;
  referenceImage?: string;
  apiKey?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

interface APIResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 系统提示词
const SYSTEM_PROMPT = `请生成一张小红书风格的图文内容图片。
【合规特别注意的】注意不要带有任何小红书的logo，不要有右下角的用户id以及logo
【合规特别注意的】用户给到的参考图片里如果有水印和logo（尤其是注意右下角，左上角），请一定要去掉

页面内容：{page_content}

页面类型：{page_type}

如果当前页面类型不是封面页的话，你要参考最后一张图片作为封面的样式

后续生成风格要严格参考封面的风格，要保持风格统一。

设计要求：

1. 整体风格
- 小红书爆款图文风格
- 清新、精致、有设计感
- 适合年轻人审美
- 配色和谐，视觉吸引力强

2. 文字排版
- 文字清晰可读，字号适中
- 重要信息突出显示
- 排版美观，留白合理
- 支持 emoji 和符号
- 如果是封面，标题要大而醒目

3. 视觉元素
- 背景简洁但不单调
- 可以有装饰性元素（如图标、插画）
- 配色温暖或清新
- 保持专业感

4. 页面类型特殊要求

[封面] 类型：
- 标题占据主要位置，字号最大
- 副标题居中或在标题下方
- 整体设计要有吸引力和冲击力
- 背景可以更丰富，有视觉焦点

[内容] 类型：
- 信息层次分明
- 列表项清晰展示
- 重点内容用颜色或粗体强调
- 可以有小图标辅助说明

[总结] 类型：
- 总结性文字突出
- 可以有勾选框或完成标志
- 给人完成感和满足感
- 鼓励性的视觉元素

5. 技术规格
- 竖版 3:4 比例（小红书标准）
- 高清画质
- 适合手机屏幕查看
- 所有文字内容必须完整呈现
- 【特别注意】无论是给到的图片还是参考文字，请仔细思考，让其符合正确的竖屏观看的排版，不能左右旋转或者是倒置。

6. 整体风格一致性
为确保所有页面风格统一，请参考完整的内容大纲和用户原始需求来确定：
- 整体色调和配色方案
- 设计风格（清新/科技/温暖/专业等）
- 视觉元素的一致性
- 排版布局的统一风格

用户原始需求：
{user_topic}

完整内容大纲参考：
---
{full_outline}
---

请根据以上要求，生成一张精美的小红书风格图片。请直接给出图片，不要有任何手机边框，或者是白色留边。`;

export async function generate(options: GenerationOptions): Promise<Buffer> {
  const { topic, referenceImage, apiKey } = options;

  // 验证 API Key
  if (!apiKey) {
    throw new Error(
      '缺少 API Key。请前往 https://api.canghe.ai/ 获取您的 API Key。'
    );
  }

  // 构建系统提示词，替换占位符
  const systemPrompt = SYSTEM_PROMPT
    .replace('{page_content}', topic)
    .replace('{page_type}', '[封面]')
    .replace('{user_topic}', topic)
    .replace('{full_outline}', topic);

  // 构建请求消息
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: systemPrompt,
        },
        ...(referenceImage
          ? [
              {
                type: 'image_url' as const,
                image_url: {
                  url: referenceImage,
                },
              },
            ]
          : []),
      ],
    },
  ];

  // 调用 API
  const response = await callAPI(messages, apiKey);

  // 提取 base64 图片数据
  const base64Image = extractBase64Image(response.choices[0].message.content);

  // 转换为 Buffer
  return Buffer.from(base64Image, 'base64');
}

function callAPI(messages: ChatMessage[], apiKey: string): Promise<APIResponse> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'gemini-3-pro-image-preview',
      messages,
      max_tokens: 4096,
    });

    const req = request(
      'https://api.canghe.ai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const jsonResponse = JSON.parse(responseData);

            // 检查 API 错误
            if (res.statusCode !== 200) {
              if (jsonResponse.error) {
                if (jsonResponse.error.code === 'invalid_api_key' ||
                    jsonResponse.error.message?.includes('api key') ||
                    jsonResponse.error.message?.includes('API Key') ||
                    jsonResponse.error.message?.includes('unauthorized') ||
                    res.statusCode === 401) {
                  reject(new Error(
                    'API Key 无效。请前往 https://api.canghe.ai/ 获取正确的 API Key。'
                  ));
                } else {
                  reject(new Error(`API Error (${res.statusCode}): ${jsonResponse.error.message}`));
                }
              } else {
                reject(new Error(`API Error (${res.statusCode})`));
              }
              return;
            }

            resolve(jsonResponse);
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error}`));
          }
        });
      }
    );

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

function extractBase64Image(content: string): string {
  // 匹配 ![image](data:image/jpeg;base64,...) 格式
  const match = content.match(/!\[image\]\(data:image\/[a-z]+;base64,([A-Za-z0-9+/=]+)\)/);

  if (!match || !match[1]) {
    throw new Error('Failed to extract base64 image from response');
  }

  return match[1];
}

// 主函数
export async function main(args: string[]): Promise<void> {
  const topic = args[0];
  const apiKey = args[1] || process.env.CANGHE_API_KEY;

  if (!topic) {
    console.error('Usage: xiaohongshu-cover-generator <topic> [apiKey]');
    console.error('Or set environment variable: CANGHE_API_KEY');
    console.error('');
    console.error('Get your API Key from: https://api.canghe.ai/');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('⚠️  缺少 API Key');
    console.error('');
    console.error('请提供 API Key 才能使用此功能：');
    console.error('方式一：');
    console.error('  npm start "主题" "your-api-key"');
    console.error('');
    console.error('方式二：');
    console.error('  export CANGHE_API_KEY="your-api-key"');
    console.error('  npm start "主题"');
    console.error('');
    console.error('获取 API Key：https://api.canghe.ai/');
    process.exit(1);
  }

  try {
    const imageBuffer = await generate({ topic, apiKey });

    // 保存图片到当前目录
    const fs = await import('fs');
    const path = await import('path');
    const timestamp = Date.now();
    const outputPath = path.join(process.cwd(), `xiaohongshu-cover-${timestamp}.png`);

    fs.writeFileSync(outputPath, imageBuffer);
    console.log(`Cover image saved to: ${outputPath}`);
  } catch (error) {
    console.error('');
    console.error('❌ 生成封面失败：');
    if (error instanceof Error) {
      console.error(error.message);
      // 如果是 API Key 相关错误，提供获取链接
      if (error.message.includes('API Key') || error.message.includes('api key')) {
        console.error('');
        console.error('获取新的 API Key：https://api.canghe.ai/');
      }
    } else {
      console.error(String(error));
    }
    process.exit(1);
  }
}

// 调用主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch(console.error);
}
