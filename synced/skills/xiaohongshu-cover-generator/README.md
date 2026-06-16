# 小红书封面生成器

根据用户输入的主题，自动生成小红书风格的封面图片。

## 使用方式

### 获取 API Key

在使用之前，您需要先获取 API Key：

1. 访问 https://api.canghe.ai/
2. 注册/登录账号
3. 获取您的 API Key

### 配置 API Key

有两种方式配置 API Key：

**方式一：通过命令行参数传递**

```bash
npm start "复古学院风穿搭" "your-api-key-here"
```

**方式二：通过环境变量设置**

```bash
export CANGHE_API_KEY="your-api-key-here"
npm start "复古学院风穿搭"
```

### 使用示例

直接输入你想要的主题，例如：

```bash
# 命令行参数方式
npm start "复古学院风穿搭" "your-api-key-here"

# 环境变量方式
export CANGHE_API_KEY="your-api-key-here"
npm start "秋季护肤指南"

# 更多示例
npm start "职场新人必读书单"
npm start "周末探店推荐"
```

## 功能特点

- 自动生成符合小红书风格的封面图片
- 支持任意主题输入
- 图片比例为竖版 3:4（适合手机屏幕）
- 设计清新、精致、年轻化
- 自动去除水印和logo

## API Key 说明

- API Key 是必需的，没有 API Key 将无法使用
- 如果 API Key 无效或过期，系统会提示您前往 https://api.canghe.ai/ 获取新的 API Key
- API Key 通过参数或环境变量传递，安全性更高

## 错误处理

如果出现以下错误：

- `缺少 API Key`：请前往 https://api.canghe.ai/ 获取您的 API Key
- `API Key 无效`：请检查您的 API Key 是否正确，或前往 https://api.canghe.ai/ 获取新的 API Key
- `API Error`：请检查网络连接或稍后重试

## 输出

生成的图片会保存到当前目录，文件名格式为：`xiaohongshu-cover-{timestamp}.png`
