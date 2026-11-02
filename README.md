# 小朋友图片表达网站（Vite + React）

这是一个给小朋友使用的表达辅助网站。
小朋友可以先选择图片，再选择人称和动词，点击“生成一句话”后，系统会调用千问大模型 API 生成一句简单中文句子。

## 功能

- 20 张日常物品图片，已完成中文标签标注
- 图片可多选
- 内置常用人称和动词（中文）
- 接入千问 API（只需配置 API Key）
- 适配桌面与手机

## 图片标签清单

1. 0.webp: 食用油
2. 1.webp: 食盐
3. 2.webp: 酱油
4. 3.webp: 大米
5. 4.webp: 陈醋
6. 5.webp: 鸡蛋
7. 6.webp: 白糖
8. 7.webp: 苹果
9. 8.webp: 面包
10. 9.webp: 纯牛奶
11. 10.webp: 香蕉
12. 11.webp: 水
13. 12.webp: 茶
14. 13.webp: 咖啡
15. 14.webp: 椅子
16. 15.webp: 桌子
17. 16.webp: 床
18. 17.webp: 笔记本电脑
19. 18.webp: 手机
20. 19.webp: 电视

## 启动方式

1. 安装依赖

```bash
npm install
```

2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入你的千问 API Key：

```env
VITE_QWEN_API_KEY=你的千问APIKey
VITE_QWEN_MODEL=qwen-plus
```

3. 本地运行

```bash
npm run dev
```

4. 构建

```bash
npm run build
```

## Netlify 部署（含图片完整性校验）

1. 执行一体化构建与图片校验：

```bash
npm run build:netlify
```

2. 生成可上传压缩包（可选）：

```bash
zip -rq dist-netlify.zip dist
```

3. 在 Netlify 上传：
- 直接拖拽 `dist` 文件夹，或上传 `dist-netlify.zip` 解压后的内容
- 若用仓库持续部署，已提供 `netlify.toml`（发布目录固定为 `dist`）

## 千问 API 调用代码文件

调用逻辑在：

- `src/api/qwen.js`

这个文件只依赖 `VITE_QWEN_API_KEY`，你只需要把 Key 配好即可使用。

## 说明

当前实现为前端直接请求千问接口，适合本地演示或内部测试。
如果后续要公开部署，建议把 API 调用改为后端代理，避免前端暴露 Key。
