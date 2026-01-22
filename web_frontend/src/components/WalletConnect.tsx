import React from 'react';

interface WalletConnectProps {
  isConnected: boolean;
  address: string;
  onConnect: (address: string) => void;
}

const WalletConnect: React.FC<WalletConnectProps> = ({ isConnected, address, onConnect }) => {
  const connectWallet = async () => {
    try {
      if (typeof (window as any).ethereum === 'undefined') {
        alert('请先安装 MetaMask 钱包\n\n下载地址: https://metamask.io/');
        return;
      }

      // 直接使用 request 方法
      const accounts = await (window as any).ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts && accounts.length > 0) {
        onConnect(accounts[0]);
      }
    } catch (error: any) {
      console.error('连接钱包失败:', error);
      if (error.code === 4001) {
        alert('您拒绝了连接请求');
      } else {
        alert(`连接失败: ${error.message}`);
      }
    }
  };

  return (
    <div className="wallet-connect">
      {isConnected ? (
        <div className="wallet-info">
          <svg className="wallet-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
          <span className="wallet-address">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          <span className="status-badge connected">已连接</span>
        </div>
      ) : (
        <button className="btn btn-connect" onClick={connectWallet}>
          连接钱包
        </button>
      )}
    </div>
  );
};

export default WalletConnect;
