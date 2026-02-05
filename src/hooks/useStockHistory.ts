import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StockHistoryEntry {
  id: string;
  product_id: string;
  previous_stock: number;
  new_stock: number;
  change_amount: number;
  change_type: string;
  notes: string | null;
  changed_by: string | null;
  created_at: string;
  products?: {
    id: string;
    name: string;
    units?: {
      abbreviation: string | null;
    };
  };
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

export interface StockTrend {
  date: string;
  totalStock: number;
  changes: number;
}

export function useStockHistory(productId?: string, limit = 50, category?: 'sellable' | 'consumable') {
  return useQuery({
    queryKey: ['stock-history', productId, limit, category],
    queryFn: async () => {
      let query = supabase
        .from('stock_history')
        .select(`
          *,
          products (id, name, category, units (abbreviation)),
          profiles!stock_history_changed_by_fkey (full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter by category if specified
      let filtered = data as (StockHistoryEntry & { products?: { category?: string } })[];
      if (category) {
        filtered = filtered.filter(entry => entry.products?.category === category);
      }
      
      return filtered as StockHistoryEntry[];
    },
  });
}

export function useStockTrends(days = 30) {
  return useQuery({
    queryKey: ['stock-trends', days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('stock_history')
        .select('created_at, change_amount, new_stock')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by date and calculate daily totals
      const dailyData: Record<string, { changes: number; lastStock: number }> = {};
      
      data?.forEach(entry => {
        const date = new Date(entry.created_at).toISOString().split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = { changes: 0, lastStock: 0 };
        }
        dailyData[date].changes += Math.abs(Number(entry.change_amount));
        dailyData[date].lastStock = Number(entry.new_stock);
      });

      // Fill in missing dates
      const trends: StockTrend[] = [];
      const currentDate = new Date(startDate);
      let runningStock = 0;

      while (currentDate <= new Date()) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (dailyData[dateStr]) {
          runningStock = dailyData[dateStr].lastStock;
          trends.push({
            date: dateStr,
            totalStock: runningStock,
            changes: dailyData[dateStr].changes,
          });
        } else {
          trends.push({
            date: dateStr,
            totalStock: runningStock,
            changes: 0,
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return trends;
    },
  });
}

// Simple forecasting based on moving average
export function useStockForecast(productId: string, forecastDays = 30) {
  return useQuery({
    queryKey: ['stock-forecast', productId, forecastDays],
    queryFn: async () => {
      // Get last 30 days of history for the product
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('stock_history')
        .select('created_at, change_amount, new_stock, change_type')
        .eq('product_id', productId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Calculate average daily consumption (decreases only)
      const dailyDecreases: Record<string, number> = {};
      
      data?.forEach(entry => {
        if (entry.change_type === 'decrease' || entry.change_type === 'sale' || Number(entry.change_amount) < 0) {
          const date = new Date(entry.created_at).toISOString().split('T')[0];
          if (!dailyDecreases[date]) {
            dailyDecreases[date] = 0;
          }
          dailyDecreases[date] += Math.abs(Number(entry.change_amount));
        }
      });

      const decreaseValues = Object.values(dailyDecreases);
      const avgDailyConsumption = decreaseValues.length > 0 
        ? decreaseValues.reduce((a, b) => a + b, 0) / decreaseValues.length
        : 0;

      // Get current stock
      const { data: product } = await supabase
        .from('products')
        .select('current_stock, low_stock_threshold')
        .eq('id', productId)
        .single();

      const currentStock = Number(product?.current_stock || 0);
      const lowThreshold = Number(product?.low_stock_threshold || 0);

      // Generate forecast
      const forecast = [];
      let projectedStock = currentStock;
      const today = new Date();

      for (let i = 0; i <= forecastDays; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        
        forecast.push({
          date: date.toISOString().split('T')[0],
          projected: Math.max(0, projectedStock),
          threshold: lowThreshold,
          isHistorical: i === 0,
        });

        projectedStock -= avgDailyConsumption;
      }

      // Calculate days until low stock
      const daysUntilLow = avgDailyConsumption > 0 
        ? Math.floor((currentStock - lowThreshold) / avgDailyConsumption)
        : null;

      return {
        forecast,
        avgDailyConsumption,
        daysUntilLow,
        currentStock,
      };
    },
    enabled: !!productId,
  });
}
