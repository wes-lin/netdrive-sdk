# netdrive-sdk

[![NPM](https://nodei.co/npm/@netdrive-sdk/ilanzou.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/@netdrive-sdk/ilanzou/)

> 基于node.js的网盘sdk,现已支持小飞机网盘/蓝奏云优享

<div align="center">
  <a href="https://www.npmjs.org/package/@netdrive-sdk/ilanzou">
    <img src="https://img.shields.io/npm/v/@netdrive-sdk/ilanzou.svg">
  </a>
  <a href="https://packagephobia.com/result?p=@netdrive-sdk/ilanzou">
    <img src="https://packagephobia.com/badge?p=@netdrive-sdk/ilanzou">
  </a>
  <a href="https://npmcharts.com/compare/@netdrive-sdk/ilanzou?minimal=true">
    <img src="http://img.shields.io/npm/dm/@netdrive-sdk/ilanzou.svg">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg">
  </a>
</div>

## 使用方法

1. 安装依赖

```sh
npm install @netdrive-sdk/ilanzou
```

2. 初始化

```js
const { FeiJiPanClient, FileTokenStore, LanZouYClient, logger } = require('@netdrive-sdk/ilanzou')

// 设置日志输出
logger.configure({
  fileOutput: true,
  isDebugEnabled: true
})
// 使用账号密码初始化, 并且存储token
// 飞机盘
const feijiPanClient = new FeiJiPanClient({
  username: 'username',
  password: 'password',
  tokenStore: new FileTokenStore('token/feijipan_username.token')
})
// 蓝奏云优享
const lanZouYClient = new LanZouYClient({
  username: 'username',
  password: 'password',
  tokenStore: new FileTokenStore('token/lanzouy_username.token')
})
```
