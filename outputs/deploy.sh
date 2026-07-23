#!/bin/bash
# ==========================================================
# 兆辉防腐 · 抖音双账号运营系统 - 云服务器一键部署脚本
# 适用系统: Ubuntu 20.04 / 22.04 / 24.04
# 使用方法: ssh登录服务器后，运行:
#   sudo bash deploy.sh
# ==========================================================

set -e

# ── 配置区（按需修改）──
DOMAIN=""           # 域名（可选，留空用IP访问）
PORT=3456           # 服务端口
REPO_URL="https://github.com/zhaohui332/zhaohui-douyin-planner.git"
INSTALL_DIR="/opt/zhaohui-douyin"

echo ""
echo "========================================"
echo "  兆辉防腐 · 抖音运营系统 部署脚本"
echo "========================================"
echo ""

# ── 1. 更新系统 ──
echo "[1/6] 更新系统包..."
apt-get update -y > /dev/null 2>&1
apt-get install -y curl wget git > /dev/null 2>&1

# ── 2. 安装 Node.js ──
echo "[2/6] 安装 Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y nodejs > /dev/null 2>&1
fi
echo "  Node.js $(node --version)"
echo "  npm $(npm --version)"

# ── 3. 拉取代码 ──
echo "[3/6] 拉取代码..."
if [ -d "$INSTALL_DIR" ]; then
    cd $INSTALL_DIR
    git pull
else
    git clone $REPO_URL $INSTALL_DIR
    cd $INSTALL_DIR
fi

# ── 4. 安装依赖 ──
echo "[4/6] 安装依赖..."
cd $INSTALL_DIR
npm install > /dev/null 2>&1
echo "  依赖安装完成"

# ── 5. 创建 systemd 服务 ──
echo "[5/6] 创建系统服务..."
cat > /etc/systemd/system/zhaohui-douyin.service << 'EOF'
[Unit]
Description=兆辉防腐 · 抖音双账号运营系统
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/zhaohui-douyin
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable zhaohui-douyin > /dev/null 2>&1
systemctl restart zhaohui-douyin

# ── 6. 配置防火墙 ──
echo "[6/6] 配置防火墙..."
# ufw
if command -v ufw &> /dev/null; then
    ufw allow $PORT/tcp > /dev/null 2>&1
    ufw --force enable > /dev/null 2>&1 || true
fi
# iptables fallback
if ! command -v ufw &> /dev/null; then
    iptables -I INPUT -p tcp --dport $PORT -j ACCEPT 2>/dev/null || true
fi

echo ""
echo "========================================"
echo "  ✅ 部署完成！"
echo "========================================"
echo ""

# 获取服务器IP
SERVER_IP=$(curl -s http://checkip.amazonaws.com 2>/dev/null || curl -s https://api.ipify.org 2>/dev/null || echo "获取IP失败")

echo "  访问地址: http://$SERVER_IP:$PORT"
echo ""
echo "  管理命令:"
echo "    systemctl status zhaohui-douyin   # 查看状态"
echo "    systemctl restart zhaohui-douyin  # 重启服务"
echo "    journalctl -u zhaohui-douyin -f   # 查看实时日志"
echo ""
echo "  数据目录: $INSTALL_DIR/data/"
echo "  每个员工首次打开浏览器输入姓名即可登录"
echo "  需要配置 DeepSeek API 密钥后才能使用AI功能"
echo ""
