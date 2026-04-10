import { useEffect, useState, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ShoppingCart, TrendingUp, Package, Loader2 } from 'lucide-react';

interface Order {
  retailcrm_id: number;
  total_sum: number;
  created_at: string;
  status: string;
}

interface ChartData {
  date: string;
  timestamp: number;
  total: number;
  count: number;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `₸${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `₸${(value / 1000).toFixed(1)}K`;
  return `₸${Math.round(value)}`;
};

const App = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterDays, setFilterDays] = useState<number>(0); // 0 means 'All Time'

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('retailcrm_id, total_sum, created_at, status')
          .order('created_at', { ascending: true });

        if (error) throw error;
        if (data) setOrders(data);
      } catch (err: any) {
        console.error('Error fetching orders:', err);
        setFetchError(err.message || 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const chartData = useMemo(() => {
    if (orders.length === 0) return [];

    let filtered = orders;
    if (filterDays > 0) {
      const cutoff = Date.now() - filterDays * 24 * 60 * 60 * 1000;
      filtered = orders.filter(o => new Date(o.created_at).getTime() >= cutoff);
    }

    if (filtered.length === 0) return [];

    // Determine granularity
    let granularity: 'day' | 'week' | 'month' = 'day';
    const dates = filtered.map(o => new Date(o.created_at).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const spanDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);

    if (spanDays > 180) granularity = 'month';
    else if (spanDays > 32) granularity = 'week';

    const grouped = filtered.reduce((acc: Record<string, ChartData>, order) => {
      const dateObj = new Date(order.created_at);
      let key: string;
      let label: string;
      let timestamp: number;

      if (granularity === 'month') {
        key = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;
        label = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        timestamp = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).getTime();
      } else if (granularity === 'week') {
        const day = dateObj.getDay();
        const diff = dateObj.getDate() - day;
        const startOfWeek = new Date(dateObj.getFullYear(), dateObj.getMonth(), diff);
        startOfWeek.setHours(0, 0, 0, 0);
        key = startOfWeek.toISOString();
        label = `Wk ${Math.ceil(startOfWeek.getDate() / 7)}, ${startOfWeek.toLocaleDateString('en-US', { month: 'short' })}`;
        timestamp = startOfWeek.getTime();
      } else {
        key = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).toISOString();
        label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        timestamp = new Date(key).getTime();
      }

      if (!acc[key]) {
        acc[key] = { date: label, timestamp, total: 0, count: 0 };
      }
      acc[key].total += order.total_sum;
      acc[key].count += 1;
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => a.timestamp - b.timestamp);
  }, [orders, filterDays]);

  const totalRevenue = orders.reduce((sum, o) => sum + o.total_sum, 0);
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  if (fetchError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-red-500">
        <p>Error: {fetchError}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/30 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white/80 to-white/50 tracking-tight">
              Order Insights
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">Real-time performance analytics from Supabase</p>
          </div>
          <div className="flex flex-col items-end px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.2em] mb-1">Lifetime Revenue</p>
            <p className="text-3xl font-bold text-white tracking-tighter">
              ₸{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            title="Total Orders" 
            value={orders.length.toLocaleString()} 
            icon={<ShoppingCart className="h-5 w-5" />} 
            description="Across all categories"
          />
          <Card 
            title="Avg. Ticket" 
            value={`₸${avgOrderValue.toFixed(0)}`} 
            icon={<TrendingUp className="h-5 w-5" />} 
            description="Revenue per order"
          />
          <Card 
            title="Active States" 
            value={new Set(orders.map(o => o.status)).size} 
            icon={<Package className="h-5 w-5" />} 
            description="Current order segments"
          />
        </div>

        <div className="glass rounded-[32px] p-6 md:p-10 space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">Revenue Performance</h2>
              <p className="text-muted-foreground text-sm mt-1">Daily order volume aggregation</p>
            </div>
            <div className="flex items-center gap-4">
               <div className="flex bg-white/[0.03] p-1 rounded-xl border border-white/5">
                  {[
                    { label: '7D', value: 7 },
                    { label: '30D', value: 30 },
                    { label: 'All', value: 0 }
                  ].map((range) => (
                    <button
                      key={range.label}
                      onClick={() => setFilterDays(range.value)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                        filterDays === range.value 
                        ? 'bg-primary text-white shadow-[0_0_15px_rgba(var(--primary),0.3)]' 
                        : 'text-muted-foreground hover:text-white'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
               </div>
               <div className="h-8 w-px bg-white/5 mx-2" />
               <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Revenue Projection</span>
               </div>
            </div>
          </div>
          
          <div className="h-[400px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={filterDays === 0 ? chartData : chartData.filter(d => d.timestamp >= Date.now() - filterDays * 24 * 60 * 60 * 1000)} 
                margin={{ top: 10, right: 10, left: 40, bottom: 40 }}
              >
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={1}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600 }} 
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600 }}
                  tickFormatter={formatCurrency}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '16px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                    padding: '12px'
                  }}
                  itemStyle={{ color: 'hsl(var(--primary))', fontSize: '14px', fontWeight: 600 }}
                  labelStyle={{ color: '#fff', marginBottom: '4px', fontWeight: 700 }}
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Revenue']}
                />
                <Bar 
                  dataKey="total" 
                  fill="url(#colorTotal)" 
                  radius={[8, 8, 0, 0]}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const Card = ({ title, value, icon, description }: { title: string; value: string | number; icon: React.ReactNode; description: string }) => (
  <div className="glass rounded-[28px] p-6 flex flex-col justify-between group transition-all duration-500 hover:scale-[1.02] hover:bg-white/[0.06] border border-white/5">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
        <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
      </div>
      <div className="p-3 rounded-2xl bg-white/[0.03] text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
        {icon}
      </div>
    </div>
    <div className="mt-4 pt-4 border-t border-white/5">
      <p className="text-xs text-muted-foreground/60">{description}</p>
    </div>
  </div>
);

export default App;
