import plugin from '../../lib/plugins/plugin.js';
import { segment } from "oicq";
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars'; // Import Handlebars
import net from 'net'; // Import Node.js net module for tcping

// 硬编码需要进行延迟测试的网站列表 (格式: 'host:port' 或 'host')
const latencyTestUrls = [
    'www.github.com:443', // Specify port 443 for HTTPS
    'www.gitee.com:443'   // Specify port 443 for HTTPS
];

// 截图参数配置
const deviceScaleFactor = 1.5; // 设备缩放因子 (Increased for potentially sharper image)

// 背景图片 URL
const backgroundImageUrl = 'https://gitee.com/T060925ZX/iloli-plugin/raw/main/resources/image/nh.webp'; // 设置为用户提供的 Gitee 图片 URL


// Embed the HTML template directly as a string
const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>System Status</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-image: url('{{backgroundImageUrl}}'); /* Added background image */
            background-size: cover; /* Cover the entire background */
            background-position: center center; /* Center the background image */
            background-repeat: no-repeat; /* Do not repeat the background image */
            /* Removed background-attachment: fixed; to fix scrolling screenshot issue */
            background-color: #f3f4f6; /* Fallback background color */
            padding: 20px;
            line-height: 1.6;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            min-height: 100vh; /* Ensure body is at least viewport height */
        }
        .container {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        .card {
            background-color: rgba(255, 255, 255, 0.5); /* Semi-transparent white */
            backdrop-filter: blur(10px); /* Frosted glass effect */
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
            display: flex;
            flex-direction: column;
            border: 1px solid rgba(229, 231, 235, 0.7); /* Slightly less transparent border */
            overflow: hidden;
        }
        .card-title {
            font-size: 1.4rem;
            font-weight: bold;
            margin-bottom: 15px;
            color: #1f2937;
            border-bottom: 2px solid rgba(209, 213, 219, 0.7); /* Slightly less transparent separator */
            padding-bottom: 10px;
        }
        .card-content p {
            margin-bottom: 10px;
            color: #4b5563;
        }
        .card-content strong {
            color: #111827;
        }
        .progress-bar-container {
            width: 100%;
            background-color: rgba(229, 231, 235, 0.9); /* Slightly less transparent background */
            border-radius: 5px;
            overflow: hidden;
            margin-top: 10px;
            height: 25px; /* Increased height for disk bar */
            display: flex;
            align-items: center;
            position: relative; /* Needed for absolute positioning of text */
        }
        .progress-bar {
            height: 100%; /* Fill container height */
            text-align: center;
            color: white;
            font-size: 0.8rem;
            line-height: 25px; /* Center text vertically */
            border-radius: 5px; /* Rounded corners for bar */
            transition: width 0.5s ease-in-out;
            position: absolute; /* Position bar within container */
            top: 0;
            left: 0;
        }
         .progress-bar-text {
             position: absolute;
             width: 100%;
             text-align: center;
             color: #1f2937; /* Dark text for readability */
             font-weight: bold;
             font-size: 0.9rem;
             z-index: 1; /* Ensure text is above the bar */
             text-shadow: 0 0 5px rgba(255, 255, 255, 0.8); /* Subtle shadow */
         }
        .bg-green-500 { background-color: #34d399; }
        .bg-yellow-500 { background-color: #f59e0b; }
        .bg-red-500 { background-color: #ef4444; }
        .bg-blue-500 { background-color: #3b82f6; }
        .bg-gray-700 { background-color: #374151; } /* Dark gray for buffer/cache */


        /* Style for preformatted text like process list */
        pre {
            background-color: rgba(249, 250, 251, 0.9); /* Slightly less transparent */
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 0.875rem;
            color: #374151;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        /* Basic styling for network stats table */
        .network-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 0.9rem;
        }
        .network-table th, .network-table td {
            border: 1px solid rgba(229, 231, 235, 0.7); /* Slightly less transparent border */
            padding: 10px;
            text-align: left;
        }
        .network-table th {
            background-color: rgba(243, 244, 246, 0.9); /* Slightly less transparent */
            font-weight: bold;
            color: #374151;
        }

        /* Pie Chart Container */
        .pie-chart-container {
            width: 120px;
            height: 120px;
            margin: 15px auto;
            position: relative;
        }

        /* SVG Pie Chart Styles */
        .pie-chart {
            transform: rotate(-90deg);
        }
        .pie-chart circle {
            transition: stroke-dashoffset 0.35s;
            stroke-linecap: round; /* Rounded ends for segments */
        }

        /* Pie Chart Percentage Text */
        .pie-chart-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 1.2rem;
            font-weight: bold;
            color: #1f2937;
            text-shadow: 0 0 5px rgba(255, 255, 255, 0.8);
        }


        .flex-container {
            display: flex;
            justify-content: space-around;
            align-items: center;
            flex-wrap: wrap;
        }

        .chart-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 10px;
        }

        .chart-label {
            font-size: 0.9rem;
            color: #374151;
            margin-top: 5px;
            text-align: center;
        }

        /* Disk item layout */
        .disk-item {
            display: flex;
            align-items: center;
            margin-bottom: 10px; /* Space between disk items */
        }

        .disk-label {
            font-weight: bold;
            color: #111827;
            width: 80px; /* Increased width for drive label */
            text-align: right;
            padding-right: 15px; /* Increased padding for space before bar */
            flex-shrink: 0; /* Prevent shrinking */
            margin-right: 10px; /* Add 10px gap */
        }

         .disk-bar-wrapper {
             flex-grow: 1; /* Allow bar to take remaining space */
             position: relative;
             height: 25px; /* Match progress bar container height */
             background-color: rgba(229, 231, 235, 0.9);
             border-radius: 5px;
             overflow: hidden;
             display: flex; /* Use flexbox to position text and bar */
             align-items: center;
         }

         .disk-bar {
             height: 100%;
             background-color: #3b82f6; /* Default blue color for disk usage */
             border-radius: 5px;
             transition: width 0.5s ease-in-out;
             position: absolute; /* Position bar within wrapper */
             top: 0;
             left: 0;
              z-index: 0; /* Ensure bar is behind text */
         }

         .disk-text {
             position: absolute; /* Changed back to absolute */
             width: 100%;
             text-align: right; /* Align text to the right */
             color: white; /* White text on bar */
             font-weight: bold;
             font-size: 0.9rem;
             line-height: 25px; /* Vertically center text */
             z-index: 1; /* Ensure text is above the bar */
             text-shadow: 0 0 5px rgba(0, 0, 0, 0.5); /* Subtle dark shadow */
             padding: 0 10px; /* Add padding to prevent text overlap with rounded corners */
             box-sizing: border-box; /* Include padding in width calculation */
         }

         .disk-percentage {
             font-weight: bold;
             color: #111827;
             width: 60px; /* Increased width for percentage */
             text-align: right;
             padding-left: 10px; /* Add padding after the bar */
             flex-shrink: 0; /* Prevent shrinking */
         }

         /* Network Info Styles */
         .network-item {
             display: flex;
             justify-content: space-between;
             align-items: center;
             margin-bottom: 8px; /* Space between network items */
             font-size: 0.9rem;
             color: #374151;
         }

         .network-item strong {
             color: #111827;
         }

         .network-speed, .network-total {
             display: flex;
             align-items: center;
             gap: 5px; /* Space between icon and text */
         }

         .upload-speed, .download-speed {
             color: #ef4444; /* Red for upload */
         }

         .download-speed {
             color: #34d399; /* Green for download */
         }

         .upload-total, .download-total {
              color: #4b5563; /* Medium gray for total traffic */
         }

         .network-icon {
             font-size: 1rem; /* Icon size */
         }

         /* Process Info Styles */
         .process-states {
             display: flex;
             flex-wrap: wrap;
             gap: 10px; /* Space between state items */
             margin-bottom: 15px;
             justify-content: space-around; /* Distribute items evenly */
         }

         .state-item {
             background-color: rgba(229, 231, 235, 0.7);
             padding: 5px 10px;
             border-radius: 5px;
             font-size: 0.8rem;
             color: #374151;
         }

         .process-list {
             width: 100%;
             font-size: 0.875rem;
             color: #374151;
         }

         .process-header, .process-row {
             display: flex;
             padding: 8px 0;
             border-bottom: 1px solid rgba(209, 213, 219, 0.7);
         }

         .process-header {
             font-weight: bold;
             margin-bottom: 5px;
         }

         .process-row:last-child {
             border-bottom: none;
         }

         .process-list .col-name { width: 50%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } /* Adjusted width */
         .process-list .col-count { width: 15%; text-align: center; } /* Added count column */
         .process-list .col-cpu { width: 15%; text-align: center; }
         .process-list .col-mem { width: 20%; text-align: center; }

        /* Latency Test Styles */
        .latency-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 0.9rem;
            color: #374151;
        }

        .latency-item strong {
            color: #111827;
        }

        .latency-result {
            font-weight: bold;
        }

        .latency-success {
            color: #34d399; /* Green */
        }

        .latency-fail {
            color: #ef4444; /* Red */
        }


        /* Footer Styles */
        footer {
            width: 100%;
            text-align: center;
            margin-top: 2px; /* Adjusted margin-top to 2px */
            font-size: 0.8rem;
            color: #6b7280; /* Gray color */
        }

    </style>
</head>
<body>
    <div id="container" class="container">
        <div class="card">
            <div class="card-title">系统基本信息</div>
            <div class="card-content">
                <p><strong>主机名:</strong> {{systemInfo.hostname}}</p>
                <p><strong>系统版本:</strong> {{systemInfo.osInfo}}</p>
                <p><strong>内核版本:</strong> {{systemInfo.kernelRelease}}</p>
                <p><strong>运行时间:</strong> {{systemInfo.uptime}}</p>
                <p><strong>当前用户:</strong> {{systemInfo.currentUser}}</p>
            </div>
        </div>

        <div class="card">
            <div class="card-title">性能概览</div>
            <div class="card-content">
                 <div class="flex-container">
                     <div class="chart-item">
                         <div class="pie-chart-container">
                             <svg viewBox="0 0 36 36" class="pie-chart">
                                 <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(229, 231, 235, 0.7)" stroke-width="4"></circle>
                                 <circle cx="18" cy="18" r="16" fill="none" stroke="{{cpuUsage.color}}" stroke-width="4"
                                         stroke-dasharray="{{cpuUsage.dashArray}}" stroke-dashoffset="0"></circle>
                             </svg>
                              <div class="pie-chart-text">{{cpuUsage.total}}</div>
                         </div>
                         <div class="chart-label">CPU</div>
                     </div>

                     <div class="chart-item">
                         <div class="pie-chart-container">
                             <svg viewBox="0 0 36 36" class="pie-chart">
                                 <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(229, 231, 235, 0.7)" stroke-width="4"></circle> <circle cx="18" cy="18" r="16" fill="none" stroke="#3b82f6" stroke-width="4"
                                         stroke-dasharray="{{memoryInfo.usedDashArray}}" stroke-dashoffset="0"></circle>
                             </svg>
                              <div class="pie-chart-text">{{memoryInfo.usedPercentage}}</div>
                         </div>
                         <div class="chart-label">内存</div>
                     </div>

                     {{#if swapInfo.available}}
                     <div class="chart-item">
                         <div class="pie-chart-container">
                             <svg viewBox="0 0 36 36" class="pie-chart">
                                 <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(229, 231, 235, 0.7)" stroke-width="4"></circle> <circle cx="18" cy="18" r="16" fill="none" stroke="#3b82f6" stroke-width="4"
                                         stroke-dasharray="{{swapInfo.usedDashArray}}" stroke-dashoffset="0"></circle>
                             </svg>
                              <div class="pie-chart-text">{{swapInfo.usedPercentage}}</div>
                         </div>
                         <div class="chart-label">Swap</div>
                     </div>
                     {{/if}}
                 </div>

                 <p class="mt-4"><strong>CPU型号:</strong> {{cpuInfo.model}}</p>
                 <p><strong>CPU核心数:</strong> {{cpuInfo.cores}}</p>
                 {{#if cpuInfo.architecture}}<p><strong>架构:</strong> {{cpuInfo.architecture}}</p>{{/if}}
                 {{#if cpuInfo.mhz}}<p><strong>当前频率:</strong> {{cpuInfo.mhz}}</p>{{/if}}
                 {{#if cpuInfo.l3Cache}}<p><strong>三级缓存:</strong> {{cpuInfo.l3Cache}}</p>{{/if}}
                 {{#if memoryInfo.cacheBufferAvailable}}
                 <p><strong>缓存/缓冲:</strong> {{memoryInfo.cacheBuffer}}</p>
                 {{/if}}
                 <p><strong>内存:</strong> 已用 {{memoryInfo.used}} ({{memoryInfo.usedPercentage}}), 空闲 {{memoryInfo.free}} ({{memoryInfo.freePercentage}}), 总计 {{memoryInfo.total}}</p>
                 {{#if swapInfo.available}}
                 <p><strong>Swap:</strong> 已用 {{swapInfo.used}} ({{swapInfo.usedPercentage}}), 总计 {{swapInfo.total}}</p>
                 {{/if}}
            </div>
        </div>

        <div class="card">
            <div class="card-title">磁盘信息</div>
            <div class="card-content">
                {{#if diskInfo.length}}
                    {{#each diskInfo}}
                     <div class="disk-item">
                         <div class="disk-label">{{this.fs}}:</div>
                         <div class="disk-bar-wrapper">
                             <div class="disk-bar" style="width: {{this.use}}; background-color: {{this.color}};"></div>
                             <div class="disk-text">{{this.used}} / {{this.size}}</div>
                         </div>
                         <div class="disk-percentage">{{this.use}}</div>
                     </div>
                    {{/each}}
                {{else}}
                    <p>磁盘信息: 未知</p>
                {{/if}}
            </div>
        </div>

        <div class="card">
            <div class="card-title">网络信息</div>
            <div class="card-content">
                {{#if networkInfo.length}}
                    {{#each networkInfo}}
                     <div class="network-item">
                         <strong>{{this.name}}</strong>
                         <div class="network-speed">
                             <span class="upload-speed"><span class="network-icon">↑</span> {{this.txSpeed}}/s</span>
                             <span class="download-speed"><span class="network-icon">↓</span> {{this.rxSpeed}}/s</span>
                         </div>
                     </div>
                     <div class="network-item">
                         <strong>流量</strong>
                         <div class="network-total">
                              <span class="upload-total"><span class="network-icon">↑</span> {{this.txTotal}}</span>
                              <span class="download-total"><span class="network-icon">↓</span> {{this.rxTotal}}</span>
                         </div>
                     </div>
                     {{#unless @last}}<hr class="my-4 border-gray-300">{{/unless}} {{!-- Add separator between interfaces --}}
                    {{/each}}
                {{else}}
                <p>网络信息: 未知</p>
                {{/if}}
            </div>
        </div>

         <div class="card">
             <div class="card-title">网络延迟测试</div>
             <div class="card-content">
                 {{#if latencyResults.length}}
                     {{#each latencyResults}}
                         <div class="latency-item">
                             <strong>{{this.host}}</strong>
                             <span class="latency-result {{this.statusClass}}">{{this.result}}</span>
                         </div>
                         {{#unless @last}}<hr class="my-2 border-gray-200">{{/unless}}
                     {{/each}}
                 {{else}}
                     <p>无法获取网络延迟信息。</p>
                 {{/if}}
             </div>
         </div>


        <div class="card">
            <div class="card-title">系统负载</div>
            <div class="card-content">
                <p><strong>1分钟负载:</strong> {{loadInfo.min1}}</p>
                <p><strong>5分钟负载:</strong> {{loadInfo.min5}}</p>
                <p><strong>15分钟负载:</strong> {{loadInfo.min15}}</p>
            </div>
        </div>

        <div class="card">
            <div class="card-title">进程信息</div>
            <div class="card-content">
                 <div class="process-states">
                     <div class="state-item"><strong>全部:</strong> {{processInfo.states.Total}}</div>
                     <div class="state-item"><strong>运行中:</strong> {{processInfo.states.Running}}</div>
                     <div class="state-item"><strong>阻塞:</strong> {{processInfo.states.Blocked}}</div>
                     <div class="state-item"><strong>休眠:</strong> {{processInfo.states.Sleeping}}</div>
                     <div class="state-item"><strong>未知:</strong> {{processInfo.states.Unknown}}</div>
                 </div>

                <p class="mt-4"><strong>进程列表</strong></p>
                {{#if processInfo.topProcessesList.length}}
                <div class="process-list mt-2">
                    <div class="process-header">
                        <div class="col-name">Name</div>
                        <div class="col-count">Count</div> {{!-- Added Count Header --}}
                        <div class="col-cpu">CPU</div>
                        <div class="col-mem">MEM</div>
                    </div>
                    {{#each processInfo.topProcessesList}}
                    <div class="process-row">
                        <div class="col-name">{{this.name}}</div>
                        <div class="col-count">{{this.count}}</div> {{!-- Display Count --}}
                        <div class="col-cpu">{{this.cpu}}</div>
                        <div class="col-mem">{{this.mem}}</div>
                    </div>
                    {{/each}}
                </div>
                {{else}}
                    <p>无法获取进程列表。</p>
                {{/if}}
            </div>
        </div>

        {{#if tempInfo}}
        <div class="card">
            <div class="card-title">温度信息</div>
            <div class="card-content">
                {{#each tempInfo}}
                <p><strong>{{this.label}}:</strong> {{this.value}}</p>
                {{/each}}
            </div>
        </div>
        {{/if}}

        {{#if containerInfo}}
        <div class="card">
            <div class="card-title">容器环境</div>
            <div class="card-content">
                <p>运行在容器环境中</p>
            </div>
        </div>
        {{/if}}

        <footer>
            <p>Created by Jiaozi ☉ System Status Plugin Lite</p>
        </footer>

    </div>
</body>
</html>
`;


export class CPUSTATE extends plugin {
    constructor() {
        super({
            name: '系统状态监控',
            dsc: '获取服务器详细状态信息并渲染为图片',
            event: 'message',
            priority: 100,
            rule: [
                {
                    reg: '^#?(运行|系统)?状态$', // Updated regex
                    fnc: 'getSystemStatusImage'
                }
            ]
        });
        this.browser = null;
        this.browserLock = false;
        this.networkStats = {}; // Store previous network stats for speed calculation

        // Register Handlebars helpers
        this.registerHandlebarsHelpers();
    }

    /**
     * Register custom Handlebars helpers
     */
    registerHandlebarsHelpers() {
        // Helper to parse percentage string to float
        Handlebars.registerHelper('parseFloat', function(percentageStr) {
            if (typeof percentageStr === 'string') {
                 return parseFloat(percentageStr.replace('%', ''));
            }
            return parseFloat(percentageStr); // Handle numbers directly
        });

        // Helper for greater than comparison
        Handlebars.registerHelper('gt', function(a, b) {
            return a > b;
        });

         // Helper for not equal comparison
         Handlebars.registerHelper('ne', function(a, b) {
             return a !== b;
         });

         // Helper to replace substring
         Handlebars.registerHelper('replace', function(str, find, replace) {
             if (typeof str === 'string') {
                 return str.replace(new RegExp(find, 'g'), replace);
             }
             return str; // Return original if not a string
         });
    }


    /**
     * Initialize Puppeteer browser
     */
    async initBrowser() {
        if (this.browser && this.browser.isConnected()) {
            return this.browser;
        }
        if (this.browserLock) {
            return false;
        }
        this.browserLock = true;

        logger.info("puppeteer Chromium 启动中..."); // Use global logger
        try {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu',
                    '--disable-dev-shm-usage'
                ]
                // executablePath: '/path/to/your/chromium',
            });
            logger.info('Puppeteer browser launched.'); // Use global logger

            this.browser.on('disconnected', () => {
                logger.error('Puppeteer browser disconnected. Attempting to re-launch...'); // Use global logger
                this.browser = null;
                this.initBrowser();
            });

            return this.browser;
        } catch (err) {
            logger.error('Failed to launch Puppeteer browser:', err); // Use global logger
            this.browser = null;
            return false;
        } finally {
            this.browserLock = false;
        }
    }

    /**
     * Get system status and render as an image
     * @param {object} e - The event object
     */
    async getSystemStatusImage(e) {
        const startTime = Date.now();
        let browser;
        let page;

        try {
            browser = await this.initBrowser();
            if (!browser) {
                await e.reply('Puppeteer浏览器启动失败，无法生成图片');
                return;
            }

            page = await browser.newPage();

            // Helper functions for formatting
            const formatTime = seconds => {
                const days = Math.floor(seconds / (3600 * 24));
                const hours = Math.floor((seconds % (3600 * 24)) / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                return `${days}天${hours}小时${minutes}分钟`;
            };

            const formatBytes = bytes => {
                if (bytes === 0) return '0 B';
                const units = ['B', 'KB', 'MB', 'GB', 'TB'];
                const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
                return (bytes / Math.pow(1024, unitIndex)).toFixed(2) + ' ' + units[unitIndex];
            };

             const formatSpeed = bytesPerSecond => {
                 if (bytesPerSecond === 0 || !isFinite(bytesPerSecond)) return '0 B/s'; // Handle non-finite values
                 const units = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
                 const unitIndex = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
                 return (bytesPerSecond / Math.pow(1024, unitIndex)).toFixed(2) + ' ' + units[unitIndex];
             };


            const formatPercentage = (numerator, denominator) => {
                if (denominator === 0) return '0%';
                return ((numerator / denominator) * 100).toFixed(2) + '%';
            };

            // Collect system information
            const systemInfo = {
                hostname: os.hostname(),
                osInfo: this.getOSInfo(),
                kernelRelease: os.release(),
                uptime: formatTime(os.uptime()),
                currentUser: os.userInfo().username,
            };

            const cpus = os.cpus();
            const cpuInfo = {
                model: cpus[0].model,
                cores: cpus.length,
                architecture: os.arch(), // Use os.arch() for architecture
                mhz: '未知', // MHz not easily available cross-platform
                l3Cache: '未知', // L3 Cache not easily available cross-platform
            };


            // Calculate CPU usage for pie chart
            const cpuUsageRaw = this.calculateCPUUsage();
            const cpuTotalPercentageValue = parseFloat(cpuUsageRaw.total);
            const circumference = 2 * Math.PI * 16; // For pie chart

            const cpuUsage = {
                total: cpuTotalPercentageValue.toFixed(2) + '%', // Ensure percentage is formatted
                user: cpuUsageRaw.user + '%',
                sys: cpuUsageRaw.sys + '%',
                // Data for CPU pie chart
                dashArray: `${(cpuTotalPercentageValue / 100) * circumference} ${circumference}`, // Only need used segment length and full circumference
                color: cpuTotalPercentageValue > 80 ? '#ef4444' : cpuTotalPercentageValue > 50 ? '#f59e0b' : '#3b82f6', // Red, Yellow, Blue
            };


            // Memory information (RAM)
            const totalMem = os.totalmem();
            let usedMem = totalMem - os.freemem(); // Initial used from os module
            let cacheBufferMem = 0; // Initialize cache/buffer memory
            let freeMemAdjusted = os.freemem(); // Initial free from os module (will be adjusted)

            // Get more detailed memory info using free -b (Linux only) to get cache/buffer and accurate used/free
            if (os.platform() === 'linux') {
                try {
                    const freeOutput = execSync('free -b').toString(); // Use -b for bytes
                    const lines = freeOutput.split('\n');
                    const memLine = lines.find(line => line.match(/^Mem:/) || line.match(/^内存:/));

                    if (memLine) {
                        const parts = memLine.trim().split(/\s+/).filter(Boolean);
                        // Expected parts for free -b: [label, total, used, free, shared, buff/cache, available]
                        if (parts.length >= 7) { // Ensure all parts are available
                            const freeBTotal = parseInt(parts[1]);
                            const freeBUsed = parseInt(parts[2]); // Used by applications
                            const freeBFree = parseInt(parts[3]); // Truly free
                            const freeBShared = parseInt(parts[4]); // Shared memory
                            cacheBufferMem = parseInt(parts[5]); // buff/cache
                            const freeBAvailable = parseInt(parts[6]); // Available memory (free + buff/cache)

                            if (freeBTotal > 0) {
                                usedMem = freeBUsed; // Use used from free -b
                                freeMemAdjusted = freeBAvailable; // Use available from free -b
                            }
                        } else if (parts.length >= 6) { // Fallback if 'available' column is missing
                             const freeBTotal = parseInt(parts[1]);
                             const freeBUsed = parseInt(parts[2]);
                             const freeBFree = parseInt(parts[3]);
                             cacheBufferMem = parseInt(parts[5]);

                             if (freeBTotal > 0) {
                                 usedMem = freeBUsed;
                                 // Approximate available as free + buff/cache if 'available' column is missing
                                 freeMemAdjusted = freeBFree + cacheBufferMem;
                             }
                        }
                    }
                } catch (err) {
                     logger.error('Failed to get detailed memory info using free -b:', err.message); // Use global logger
                     // If free -b fails, fall back to os module data, cacheBufferMem remains 0
                     usedMem = totalMem - os.freemem();
                     freeMemAdjusted = os.freemem();
                }
            }


            // Calculate percentages based on the obtained values
            const usedPercentageValue = (totalMem === 0) ? 0 : (usedMem / totalMem) * 100;
            const cachePercentageValue = (totalMem === 0) ? 0 : (cacheBufferMem / totalMem) * 100;
            const freePercentageValue = (totalMem === 0) ? 0 : (freeMemAdjusted / totalMem) * 100;


            const memoryInfo = {
                total: formatBytes(totalMem),
                used: formatBytes(usedMem),
                free: formatBytes(freeMemAdjusted), // Display adjusted free memory (available)
                usedPercentage: usedPercentageValue.toFixed(2) + '%',
                freePercentage: freePercentageValue.toFixed(2) + '%',
                cacheBuffer: formatBytes(cacheBufferMem), // Display formatted cache/buffer
                cacheBufferAvailable: cacheBufferMem > 0, // Flag to show cache/buffer text
                // Data for Memory pie chart (Used and Available/Free - Free is background)
                usedDashArray: `${(usedPercentageValue / 100) * circumference} ${circumference}`,
                // We don't need a separate dashArray for free if it's the background
                usedOffset: 0, // Used starts at the top
            };


            // Swap information
            let swapInfo = {
                available: false,
                total: '未知',
                used: '未知',
                free: '未知',
                usedPercentage: '未知%',
                 // Data for Swap pie chart (default to 0%)
                usedDashArray: `0 ${circumference}`,
                freeDashArray: `${circumference}`, // Only need free segment length and full circumference
                usedColor: '#3b82f6', // Default color (Blue)
                freeColor: '#34d399', // Default color (Green)
            };

            if (os.platform() === 'linux') {
                try {
                     const freeOutput = execSync('free -b').toString(); // Use -b for bytes
                     const lines = freeOutput.split('\n');
                     const swapLine = lines.find(line => line.match(/^Swap:/) || line.match(/^交换:/));

                     if (swapLine) {
                         const parts = swapLine.trim().split(/\s+/).filter(Boolean);
                         // Expected parts: [label, total, used, free]
                         if (parts.length >= 4) {
                             const totalSwap = parseInt(parts[1]);
                             const usedSwap = parseInt(parts[2]);
                             const freeSwap = parseInt(parts[3]);

                             if (totalSwap > 0) { // Only show if Swap is available
                                 const usedSwapPercentage = (usedSwap / totalSwap) * 100;
                                 const freeSwapPercentage = (freeSwap / totalSwap) * 100;

                                 swapInfo = {
                                     available: true,
                                     total: formatBytes(totalSwap),
                                     used: formatBytes(usedSwap),
                                     free: formatBytes(freeSwap),
                                     usedPercentage: usedSwapPercentage.toFixed(2) + '%',
                                     freePercentage: freeSwapPercentage.toFixed(2) + '%',
                                     // Data for Swap pie chart
                                     usedDashArray: `${(usedSwapPercentage / 100) * circumference} ${circumference}`, // Used segment length and full circumference
                                     // Free segment will use the background color
                                     usedOffset: 0, // Used starts at the top
                                 };
                             }
                         }
                     }
                } catch (err) {
                     logger.error('Failed to get swap info:', err.message); // Use global logger
                     // swapInfo remains unavailable: false
                }
            }


            // Disk information
            const diskInfo = this.getDiskInfo().map(disk => {
                const usePercentage = parseFloat(disk.use);
                const progressBarColor = usePercentage > 80 ? 'bg-red-500' : usePercentage > 50 ? 'bg-yellow-500' : 'bg-green-500';
                return {
                    fs: disk.fs,
                    size: formatBytes(disk.size),
                    used: formatBytes(disk.used),
                    avail: formatBytes(disk.avail),
                    use: disk.use,
                    color: progressBarColor, // Add color for progress bar
                };
            });

            // Network information
            const networkInfoRaw = this.getNetworkInfo();
            const networkInfo = Object.entries(networkInfoRaw).map(([name, stats]) => ({
                name,
                rxTotal: formatBytes(stats.rxTotal),
                txTotal: formatBytes(stats.txTotal),
                rxSpeed: formatSpeed(stats.rxSpeed),
                txSpeed: formatSpeed(stats.txSpeed),
            }));

            // Store current network stats for next calculation
             this.networkStats = networkInfoRaw;


            // Perform latency tests using tcping
            const latencyResults = await this.performLatencyTests();

            // Load average
            const loadavg = os.loadavg();
            const loadInfo = {
                min1: loadavg[0].toFixed(2),
                min5: loadavg[1].toFixed(2),
                min15: loadavg[2].toFixed(2),
            };

            // Process information
            const processInfo = this.getProcessInfo(); // Get detailed process info


            // Temperature information (if available)
            const tempInfoRaw = this.getTemperatureInfo();
            const tempInfo = tempInfoRaw ? tempInfoRaw.map(temp => ({
                label: temp.label,
                value: temp.value + '°C',
            })) : null;

            // Container information
            const containerInfo = this.isInContainer(); // Get boolean flag


            // Combine data for the template
            const renderData = {
                systemInfo,
                cpuInfo,
                cpuUsage, // Includes pie chart data
                memoryInfo, // Includes pie chart data for Memory (RAM) and cache/buffer
                swapInfo, // Includes pie chart data and availability flag
                diskInfo,
                networkInfo, // Updated network info with speed and total
                latencyResults, // Added latency test results
                loadInfo,
                processInfo, // Now includes count, states, and topProcessesList
                tempInfo,
                containerInfo, // Pass boolean flag
                backgroundImageUrl: backgroundImageUrl // Pass background image URL to template
            };

            // Compile the Handlebars template
            const template = Handlebars.compile(htmlTemplate);
            // Render the HTML with the collected data
            const renderedHtml = template(renderData);


            // Use page.setContent to load the HTML string directly
            await page.setContent(renderedHtml, {
                waitUntil: 'networkidle2',
                timeout: 60000
            });

            // Wait for the container element to be available
            const container = await page.waitForSelector('#container', { timeout: 10000 });

             if (!container) {
                 logger.error('Failed to find container element after setContent.'); // Use global logger
                 await e.reply('页面加载失败，无法找到容器元素');
                 return;
            }

            // Set viewport for screenshot, using deviceScaleFactor
             await page.setViewport({
                 width: 600, // Match max-width of container
                 height: 800, // Initial height, will be overridden by fullPage
                 deviceScaleFactor: deviceScaleFactor,
             });


            // Take the screenshot of the full page
            const img = await page.screenshot({
                type: 'png',
                fullPage: true,
                omitBackground: true,
            });

            // Close the page
            await page.close();

            const endTime = Date.now();
            logger.info(`Screenshot generated in ${endTime - startTime}ms`); // Use global logger

            if (img) {
                await e.reply(segment.image(img));
            } else {
                await e.reply('生成系统状态图片失败');
            }

        } catch (err) {
            logger.error('获取系统状态或生成图片失败:', err); // Use global logger
            if (page && !page.isClosed()) {
                await page.close().catch(e => logger.error('Error closing page:', e)); // Use global logger
            }
            await e.reply('获取系统状态时出错，请检查日志');
        }
    }

    // --- Helper methods ---

    getOSInfo() {
        try {
            if (os.platform() === 'linux') {
                if (fs.existsSync('/etc/os-release')) {
                    const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
                    const match = osRelease.match(/PRETTY_NAME="(.+)"/);
                    if (match) return match[1];
                }
                if (fs.existsSync('/etc/redhat-release')) {
                    return fs.readFileSync('/etc/redhat-release', 'utf8').trim();
                }
                if (fs.existsSync('/etc/lsb-release')) {
                    const lsb = fs.readFileSync('/etc/lsb-release', 'utf8');
                    const desc = lsb.match(/DISTRIB_DESCRIPTION="(.+)"/);
                    if (desc) return desc[1];
                }
            } else if (os.platform() === 'win32') {
                // On Windows, use os.release() and os.type()
                return `${os.type()} ${os.release()}`;
            }
            return os.type() + ' ' + os.release(); // Fallback
        } catch (err) {
            logger.error('获取系统信息失败:', err);
            return os.type() + ' ' + os.release();
        }
    }


    calculateCPUUsage() {
        // This is a basic calculation, a more accurate one requires sampling over time
        const cpus = os.cpus();
        let totalIdle = 0, totalTick = 0;
        let user = 0, sys = 0;

        cpus.forEach(cpu => {
            const times = cpu.times;
            totalIdle += times.idle;
            user += times.user;
            sys += times.sys;
            totalTick += times.user + times.nice + times.sys + times.idle + times.irq;
        });

        // Avoid division by zero if totalTick is 0
        const totalUsage = totalTick === 0 ? 0 : (1 - totalIdle / totalTick) * 100;
        const userUsage = totalTick === 0 ? 0 : (user / totalTick) * 100;
        const sysUsage = totalTick === 0 ? 0 : (sys / totalTick) * 100;


        return {
            total: totalUsage.toFixed(2),
            user: userUsage.toFixed(2),
            sys: sysUsage.toFixed(2)
        };
    }

    getDiskInfo() {
        try {
            const result = [];
            if (os.platform() === 'win32') {
                // Windows: Use wmic to get disk info
                const output = execSync('wmic logicaldisk get size,freespace,caption').toString();
                const lines = output.trim().split('\n').slice(1); // Skip header

                lines.forEach(line => {
                    if (!line) return;
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 3) {
                        const fs = parts[0]; // e.g., C:
                        const freeSpace = parseInt(parts[1]); // in bytes
                        const size = parseInt(parts[2]); // in bytes

                        if (!isNaN(size) && size > 0) {
                            const used = size - freeSpace;
                            const usePercentage = ((used / size) * 100).toFixed(2) + '%';
                             result.push({
                                fs: fs,
                                size: size, // Keep as bytes for formatting later
                                used: used, // Keep as bytes for formatting later
                                avail: freeSpace, // Keep as bytes for formatting later
                                use: usePercentage,
                                mounted: fs // Use drive letter as mount point
                            });
                        }
                    }
                });

            } else { // Assume Linux or similar
                const output = execSync('df -k').toString(); // Use -k for consistent block size (1024)
                const lines = output.split('\n').slice(1);


                lines.forEach(line => {
                    if (!line) return;
                    const parts = line.trim().split(/\s+/);
                    // Filter out temporary filesystems like tmpfs, devtmpfs, etc.
                    if (parts.length >= 6 && parts[0].startsWith('/') && !['tmpfs', 'devtmpfs', 'overlay'].some(type => parts[0].includes(type))) {
                        result.push({
                            fs: parts[0],
                            size: parseInt(parts[1]) * 1024, // Convert KB to Bytes
                            used: parseInt(parts[2]) * 1024, // Convert KB to Bytes
                            avail: parseInt(parts[3]) * 1024, // Convert KB to Bytes
                            use: parts[4],
                            mounted: parts[5] // Mount point
                        });
                    }
                });

                 // Filter out redundant entries for the same mount point (e.g., docker overlays)
                 const uniqueMounts = {};
                 result.forEach(disk => {
                     // Prioritize non-overlay filesystems if multiple entries for the same mount point exist
                     if (!uniqueMounts[disk.mounted] || !disk.fs.includes('overlay')) {
                          uniqueMounts[disk.mounted] = disk;
                     }
                 });

                 return Object.values(uniqueMounts);
            }


            return result;
        } catch (err) {
            logger.error('获取磁盘信息失败:', err); // Use global logger
            return [];
        }
    }

    getNetworkInfo() {
        try {
            const networkInfo = {};
            const previousStats = this.networkStats; // Get previous stats stored in the instance
            const currentTime = Date.now();
            const timeDiff = (currentTime - (this.lastNetworkTime || currentTime)) / 1000; // Time difference in seconds
            this.lastNetworkTime = currentTime; // Store current time for next calculation

            if (os.platform() === 'win32') {
                 // Windows: Use netstat -e to get byte counts
                 // Note: This does not give per-interface stats easily or real-time speed without sampling
                 try {
                     const output = execSync('netstat -e').toString();
                     const lines = output.trim().split('\n');
                     // Look for lines like "Bytes Received" and "Bytes Sent"
                     let rxTotal = 0;
                     let txTotal = 0;

                     lines.forEach(line => {
                         if (line.includes('Bytes Received')) {
                             const match = line.match(/Bytes Received:\s+(\d+)/);
                             if (match && match[1]) rxTotal = parseInt(match[1]);
                         } else if (line.includes('Bytes Sent')) {
                             const match = line.match(/Bytes Sent:\s+(\d+)/);
                              if (match && match[1]) txTotal = parseInt(match[1]);
                         }
                     });

                     // Calculate speed based on total bytes if previous stats exist
                     let rxSpeed = 0;
                     let txSpeed = 0;
                     if (previousStats['total'] && timeDiff > 0) {
                         rxSpeed = (rxTotal - previousStats['total'].rxTotal) / timeDiff;
                         txSpeed = (txTotal - previousStats['total'].txTotal) / timeDiff;
                     }

                     networkInfo['Total'] = { // Group all traffic under 'Total' for simplicity on Windows
                         rxTotal: rxTotal,
                         txTotal: txTotal,
                         rxSpeed: rxSpeed,
                         txSpeed: txSpeed,
                     };

                 } catch (err) {
                     logger.error('Failed to get network info on Windows:', err.message);
                     // Return empty if command fails
                 }

            } else { // Assume Linux or similar
                // Get current network stats from /proc/net/dev
                const output = execSync('cat /proc/net/dev').toString();
                const lines = output.split('\n').slice(2);
                const currentStats = {};

                lines.forEach(line => {
                    if (!line) return;
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 10 && parts[0].endsWith(':')) {
                        const name = parts[0].replace(':', '');
                        // Filter out loopback interface
                        if (name !== 'lo') {
                             currentStats[name] = {
                                 rxTotal: parseInt(parts[1]), // Receive bytes
                                 txTotal: parseInt(parts[9])  // Transmit bytes
                             };
                        }
                    }
                });


                for (const name in currentStats) {
                    const current = currentStats[name];
                    const previous = previousStats[name];

                    let rxSpeed = 0;
                    let txSpeed = 0;

                    if (previous && timeDiff > 0) {
                        // Calculate speed if previous stats exist and time difference is positive
                        rxSpeed = (current.rxTotal - previous.rxTotal) / timeDiff;
                        txSpeed = (current.txTotal - previous.txTotal) / timeDiff;
                    }

                    networkInfo[name] = {
                        rxTotal: current.rxTotal,
                        txTotal: current.txTotal,
                        rxSpeed: rxSpeed,
                        txSpeed: txSpeed,
                    };
                }
            }

            return networkInfo;

        } catch (err) {
            logger.error('获取网络信息失败:', err); // Use global logger
            return {};
        }
    }

    async performLatencyTests() {
        const results = [];
        for (const url of latencyTestUrls) {
            const [host, portStr] = url.split(':');
            const port = parseInt(portStr || '443'); // Default to 443 if port not specified

            const startTime = process.hrtime(); // High-resolution time

            try {
                await new Promise((resolve, reject) => {
                    const socket = net.createConnection({ host, port, timeout: 5000 }); // 5 seconds timeout

                    socket.on('connect', () => {
                        const endTime = process.hrtime(startTime);
                        const latencyMs = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(2);
                        socket.end();
                        resolve(latencyMs);
                    });

                    socket.on('timeout', () => {
                        socket.destroy();
                        reject(new Error('Timed Out'));
                    });

                    socket.on('error', (err) => {
                        socket.destroy();
                        reject(err);
                    });
                }).then(latencyMs => {
                    results.push({
                        host: `${host}:${port}`,
                        result: `${latencyMs}ms`,
                        statusClass: 'latency-success'
                    });
                }).catch(error => {
                    logger.error(`TCPing failed for ${host}:${port}:`, error.message);
                    let errorMessage = 'Error';
                    if (error.message.includes('ETIMEDOUT')) {
                        errorMessage = 'Timed Out';
                    } else if (error.message.includes('ECONNREFUSED')) {
                        errorMessage = 'Connection Refused';
                    } else if (error.message.includes('EHOSTUNREACH')) {
                         errorMessage = 'Unreachable';
                    } else if (error.message.includes('ENOTFOUND')) {
                         errorMessage = 'Not Found';
                    } else if (error.message.includes('EAI_AGAIN')) {
                         errorMessage = 'DNS Error';
                    } else if (error.message.includes('EACCES')) {
                         errorMessage = 'Permission Denied';
                    } else if (error.message.includes('EPERM')) {
                          errorMessage = 'Operation not permitted';
                    }


                    results.push({
                        host: `${host}:${port}`,
                        result: errorMessage,
                        statusClass: 'latency-fail'
                    });
                });

            } catch (error) {
                // This catch block might be redundant with the promise catch, but kept for safety
                logger.error(`TCPing promise setup failed for ${host}:${port}:`, error);
                 results.push({
                     host: `${host}:${port}`,
                     result: 'Setup Error',
                     statusClass: 'latency-fail'
                 });
            }
        }
        return results;
    }


    getProcessInfo() {
        try {
            if (os.platform() === 'win32') {
                // For Windows, use tasklist
                try {
                    const output = execSync('tasklist /fo csv /nh').toString();
                    const lines = output.trim().split('\n');
                    const processMap = new Map();
                    let totalCount = 0;

                    lines.forEach(line => {
                        const parts = line.match(/"([^"]*)"|\S+/g); // Handle names with spaces
                        if (parts && parts.length >= 5) {
                            const name = parts[0].replace(/"/g, '');
                            const pid = parts[1].replace(/"/g, '');
                            const memUsage = parts[4].replace(/"/g, '').replace(/,/g, ''); // Remove commas from memory
                            const memBytes = parseInt(memUsage) * 1024; // tasklist gives KB

                            totalCount++;

                            if (processMap.has(name)) {
                                const existing = processMap.get(name);
                                existing.count++;
                                existing.memBytes += memBytes; // Sum memory usage
                                // CPU usage is tricky per process on Windows with simple commands, so we'll omit it for grouped view
                                processMap.set(name, existing);
                            } else {
                                processMap.set(name, {
                                    name: name,
                                    count: 1,
                                    pid: pid, // Keep one PID, though not strictly accurate for a group
                                    cpu: '未知', // CPU per process not easily available
                                    memBytes: memBytes,
                                });
                            }
                        }
                    });

                    // Convert map to array and format memory
                    const topProcessesList = Array.from(processMap.values()).map(p => ({
                        name: p.name,
                        count: p.count,
                        pid: p.pid,
                        cpu: p.cpu,
                        mem: formatBytes(p.memBytes),
                    }));

                    // Sort by memory usage (descending) and take top N (e.g., 10)
                    topProcessesList.sort((a, b) => b.memBytes - a.memBytes);
                    const topN = 10; // Display top 10 processes by memory on Windows
                    const limitedProcessList = topProcessesList.slice(0, topN);


                    return {
                        count: totalCount,
                        states: { Total: totalCount, Running: '未知', Blocked: '未知', Sleeping: '未知', Unknown: '未知' }, // States not easily available on Windows
                        topProcessesList: limitedProcessList // Grouped and limited list
                    };

                } catch (err) {
                     logger.error('Failed to get detailed process info on Windows:', err.message);
                     // Fallback to just total count if tasklist fails
                     try {
                         const totalOutput = execSync('tasklist').toString();
                         const totalCount = totalOutput.trim().split('\n').length - 1;
                         return {
                             count: totalCount,
                             states: { Total: totalCount, Running: '未知', Blocked: '未知', Sleeping: '未知', Unknown: '未知' },
                             topProcessesList: []
                         };
                     } catch (e) {
                         logger.error('Failed to get total process count on Windows:', e.message);
                         return {
                             count: '未知',
                             states: { Total: '未知', Running: '未知', Blocked: '未知', Sleeping: '未知', Unknown: '未知' },
                             topProcessesList: []
                         };
                     }
                }

            } else { // Assume Linux or similar
                // Get total process count
                const totalOutput = execSync('ps -e').toString();
                const totalCount = totalOutput.split('\n').length - 1;

                // Get process states (Linux)
                let running = 0, sleeping = 0, blocked = 0, unknown = 0;
                try {
                    const stateOutput = execSync('ps -eo state=').toString();
                    const states = stateOutput.trim().split('\n').map(s => s.trim());
                    states.forEach(state => {
                        // Common ps states: R (running), S (sleeping), D (uninterruptible sleep), Z (zombie), T (stopped), t (tracing stop), X (dead)
                        if (state === 'R') running++;
                        else if (state === 'S' || state === 'D') sleeping++;
                        else if (state === 'T' || state === 't') blocked++;
                        else unknown++; // Includes Z, X, etc.
                    });
                } catch (err) {
                    logger.error('Failed to get process states:', err.message);
                    // Fallback to unknown if state parsing fails
                    unknown = totalCount;
                    running = sleeping = blocked = 0;
                }


                // Get process list with CPU, MEM, and Command (Linux)
                // Use ps -eo comm,%cpu,%mem --no-headers to get command, cpu, mem without header
                const processListOutput = execSync('ps -eo comm,%cpu,%mem --no-headers').toString();
                const processLines = processListOutput.trim().split('\n');
                const processMap = new Map();

                processLines.forEach(line => {
                    const parts = line.trim().split(/\s+/);
                     if (parts.length >= 3) {
                         // The command might have spaces, so take the first two as CPU and MEM, rest as command
                         const cpu = parseFloat(parts[parts.length - 2]);
                         const mem = parseFloat(parts[parts.length - 1]);
                         const name = parts.slice(0, parts.length - 2).join(' '); // Reconstruct command

                         if (processMap.has(name)) {
                             const existing = processMap.get(name);
                             existing.count++;
                             existing.cpu += cpu; // Sum CPU usage (approximation for group)
                             existing.mem += mem; // Sum MEM usage (approximation for group)
                             processMap.set(name, existing);
                         } else {
                             processMap.set(name, {
                                 name: name,
                                 count: 1,
                                 cpu: cpu,
                                 mem: mem,
                             });
                         }
                     } else {
                          logger.warn(`Failed to parse process list line (unexpected format): ${line}`);
                     }
                });

                // Convert map to array, sort, format, and limit
                const topProcessesList = Array.from(processMap.values()).map(p => ({
                    name: p.name,
                    count: p.count,
                    cpu: p.cpu.toFixed(1) + '%', // Format summed CPU
                    mem: p.mem.toFixed(1) + '%', // Format summed MEM
                }));

                // Sort by summed CPU usage (descending)
                topProcessesList.sort((a, b) => parseFloat(b.cpu) - parseFloat(a.cpu));

                const topN = 10; // Display top 10 processes by CPU
                const limitedProcessList = topProcessesList.slice(0, topN);


                return {
                    count: totalCount,
                    states: { Total: totalCount, Running: running, Blocked: blocked, Sleeping: sleeping, Unknown: unknown },
                    topProcessesList: limitedProcessList // Grouped, sorted, and limited list
                };
            }
        } catch (err) {
            logger.error('获取进程信息失败:', err); // Use global logger
            return {
                count: '未知',
                states: { Total: '未知', Running: '未知', Blocked: '未知', Sleeping: '未知', Unknown: '未知' },
                topProcessesList: []
            };
        }
    }


    getTemperatureInfo() {
        // Temperature info is highly OS and hardware dependent and not easily available cross-platform via simple commands
        return null; // Indicate not available
    }

    isInContainer() {
        try {
            if (os.platform() === 'linux') {
                // Check /.dockerenv file
                if (fs.existsSync('/.dockerenv')) return true;

                // Check cgroup information
                if (fs.existsSync('/proc/1/cgroup')) {
                    const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
                    if (cgroup.includes('docker') || cgroup.includes('lxc') || cgroup.includes('containerd')) {
                        return true;
                    }
                }
            } else if (os.platform() === 'win32') {
                // Basic check for some container environments on Windows (e.g., Docker Desktop)
                // This is not exhaustive and might not detect all container types
                if (process.env.hasOwnProperty('DOTNET_RUNNING_IN_CONTAINER') || process.env.hasOwnProperty('CONTAINER_HOST')) {
                    return true;
                }
                 // Check for specific files or registry keys if needed (more complex)
            }

            return false;
        } catch (err) {
            logger.error('检查容器环境失败:', err); // Use global logger
            return false;
        }
    }
}
