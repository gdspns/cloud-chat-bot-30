import { useState, useCallback } from 'react';

interface BinanceRates {
  usdtCny: number;  // 1 USDT = ? CNY
  trxUsdt: number;  // 1 TRX = ? USDT
}

interface UseBinanceRatesReturn {
  rates: BinanceRates | null;
  loading: boolean;
  error: string | null;
  fetchRates: () => Promise<BinanceRates | null>;
  convertCnyToUsdt: (cny: number) => number | null;
  convertCnyToTrx: (cny: number) => number | null;
}

// 币安API获取实时汇率
export function useBinanceRates(): UseBinanceRatesReturn {
  const [rates, setRates] = useState<BinanceRates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRates = useCallback(async (): Promise<BinanceRates | null> => {
    setLoading(true);
    setError(null);

    try {
      // 并行获取 USDT/CNY 和 TRX/USDT 价格
      const [usdtRes, trxRes] = await Promise.all([
        fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTCNY').catch(() => null),
        fetch('https://api.binance.com/api/v3/ticker/price?symbol=TRXUSDT').catch(() => null)
      ]);

      // USDT/CNY 默认回退值
      let usdtCny = 7.25;
      if (usdtRes && usdtRes.ok) {
        try {
          const usdtData = await usdtRes.json();
          usdtCny = parseFloat(usdtData.price) || 7.25;
        } catch { /* use default */ }
      }

      // TRX/USDT 默认回退值
      let trxUsdt = 0.25;
      if (trxRes && trxRes.ok) {
        try {
          const trxData = await trxRes.json();
          trxUsdt = parseFloat(trxData.price) || 0.25;
        } catch { /* use default */ }
      }

      const newRates: BinanceRates = { usdtCny, trxUsdt };
      setRates(newRates);
      setError((!usdtRes?.ok || !trxRes?.ok) ? '使用回退汇率' : null);
      return newRates;
    } catch (err: any) {
      // 即使完全失败也返回回退值
      const fallback: BinanceRates = { usdtCny: 7.25, trxUsdt: 0.25 };
      setRates(fallback);
      setError('使用回退汇率');
      console.warn('币安API不可用，使用回退汇率:', err);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, []);

  const convertCnyToUsdt = useCallback((cny: number): number | null => {
    if (!rates) return null;
    return cny / rates.usdtCny;
  }, [rates]);

  const convertCnyToTrx = useCallback((cny: number): number | null => {
    if (!rates) return null;
    const usdt = cny / rates.usdtCny;
    return usdt / rates.trxUsdt;
  }, [rates]);

  return {
    rates,
    loading,
    error,
    fetchRates,
    convertCnyToUsdt,
    convertCnyToTrx
  };
}

export default useBinanceRates;
