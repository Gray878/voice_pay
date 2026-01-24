import React from 'react';

interface WalletConnectProps {
  isConnected: boolean;
  address: string;
  onConnect: (address: string) => void;
}

const WalletConnect: React.FC<WalletConnectProps> = ({ isConnected, address, onConnect }) => {
  const resolveMetaMaskProvider = async () => {
    const { ethereum } = window as any;
    if (ethereum?.isMetaMask) return ethereum;
    if (Array.isArray(ethereum?.providers) && ethereum.providers.length > 0) {
      const metaMaskProvider = ethereum.providers.find((provider: any) => provider.isMetaMask);
      if (metaMaskProvider) return metaMaskProvider;
    }

    return await new Promise<any>((resolve) => {
      let resolved = false;
      const handler = (event: any) => {
        const provider = event?.detail?.provider;
        if (provider?.isMetaMask) {
          resolved = true;
          window.removeEventListener('eip6963:announceProvider', handler as any);
          resolve(provider);
        }
      };

      window.addEventListener('eip6963:announceProvider', handler as any);
      window.dispatchEvent(new Event('eip6963:requestProvider'));

      setTimeout(() => {
        if (!resolved) {
          window.removeEventListener('eip6963:announceProvider', handler as any);
          resolve(null);
        }
      }, 500);
    });
  };

  const connectWallet = async () => {
    try {
      const provider = await resolveMetaMaskProvider();
      const requestFn = provider?.request;
      if (!provider || typeof requestFn !== 'function') {
        alert('请先安装 MetaMask 钱包\n\n下载地址: https://metamask.io/');
        return;
      }

      let accounts = await requestFn({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        accounts = await requestFn({ method: 'eth_accounts' });
      }

      if (accounts && accounts.length > 0) {
        onConnect(accounts[0]);
      } else if (provider?.selectedAddress) {
        onConnect(provider.selectedAddress);
      }
    } catch (error: any) {
      console.error('连接钱包失败:', error);
      if (error.code === 4001) {
        alert('您拒绝了连接请求');
      } else if (error.code === -32002) {
        const provider = await resolveMetaMaskProvider();
        if (provider?.request) {
          const accounts = await provider.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            onConnect(accounts[0]);
            return;
          }
        }
        alert('MetaMask 正在等待您的确认，请打开扩展继续');
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
